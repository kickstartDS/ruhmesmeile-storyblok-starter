#!/usr/bin/env bash
# Run a campaign in disk-sized batches (Decision 95, D-152).
#
#   pnpm campaign:split                    # dry run — prints the plan, spends nothing
#   pnpm campaign:split --apply            # actually run it
#   pnpm campaign:split --apply --arms cc-none-haiku-low
#
# Decision 95 established that concurrency here is a scheduling problem, not a
# patching one: the framework rate-limits sandbox *starts* but not sandbox
# *lifetimes*, so a 20-eval arm at 3 runs puts 60 `npm install`s in flight
# within six seconds. Splitting the eval list with EVAL_ONLY caps the peak,
# and the report resolves per eval across timestamps, so an arm split across
# six invocations reassembles into one arm at grading time.
#
# What Decision 95 left open is the part that bites: "the split is manual and
# the batch size was picked from a measured per-sandbox footprint against known
# free disk. Nothing enforces it. If an arm grows past 20 evals or the disk
# tightens, this silently returns to being D-152." The disk has since tightened
# — 41 GB free when the haiku-high campaign ran, 35 GB now — so the fixed batch
# of 10 (≈21 GB peak) no longer carries the margin it was chosen for.
#
# So the batch size is computed, not written down: free disk minus a reserve,
# divided by the per-eval peak. Re-measured before *every* batch, because the
# results tree grows underneath the campaign as it runs (~0.5 GB per 60 trials)
# and a size that was safe at batch one is not automatically safe at batch six.
#
# Dry by default, following `prune-results.ts`: the path that costs money or
# data is never the one you get by mistyping an argument.

set -u

cd "$(dirname "$0")/.." || exit 1

# Measured per-sandbox footprint from Decision 95, in tenths of a GB.
SANDBOX_TENTHS="${SANDBOX_TENTHS:-7}"
# Runs per eval — RUNS.capability. Every sandbox in a batch is live at once.
RUNS="${RUNS:-3}"
# Disk that must remain free at peak. D-152 happened at zero.
FLOOR_GB="${FLOOR_GB:-15}"
# Decision 95 validated 10 over 180 trials. Nothing above it has been tested.
MAX_BATCH="${MAX_BATCH:-10}"
# Below this the batching overhead outweighs the protection; stop and ask.
MIN_BATCH="${MIN_BATCH:-2}"

APPLY=0
ARMS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --arms) shift; while [ $# -gt 0 ] && [[ "$1" != --* ]]; do ARMS+=("$1"); shift; done ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

if [ "${#ARMS[@]}" -eq 0 ]; then
  ARMS=(
    cc-none-haiku-low
    cc-component-builder-haiku-low
    cc-design-tokens-haiku-low
    cc-both-haiku-low
  )
fi

# The eval list is derived from the tier, never pasted. A pasted list is the
# same unfalsifiable constant §39 rejects for file digests: it rots silently
# when a fixture is added, and the arm that runs 19 of 20 evals looks exactly
# like the arm that ran all of them. `paste` is excluded by construction —
# D-167 — because this asks for core+extra by name rather than globbing.
mapfile -t EVALS < <(
  npx tsx -e '
    import { evalsInTier } from "./lib/graders/targets";
    process.stdout.write(
      [...evalsInTier("core"), ...evalsInTier("extra")].join("\n") + "\n",
    );
  ' 2>/dev/null | grep -E '^[0-9]{3}-'
)

if [ "${#EVALS[@]}" -eq 0 ]; then
  printf 'could not resolve the core+extra tiers — refusing to guess\n' >&2
  exit 1
fi

free_gb() { df -BG --output=avail . | tail -1 | tr -dc '0-9'; }

# usable disk / per-eval peak, clamped to the range Decision 95 validated.
batch_size() {
  local free="$1" usable per_eval n
  usable=$(( free - FLOOR_GB ))
  [ "$usable" -le 0 ] && { printf '0\n'; return; }
  per_eval=$(( SANDBOX_TENTHS * RUNS ))
  n=$(( usable * 10 / per_eval ))
  [ "$n" -gt "$MAX_BATCH" ] && n="$MAX_BATCH"
  printf '%s\n' "$n"
}

peak_gb() { printf '%s\n' "$(( $1 * SANDBOX_TENTHS * RUNS / 10 ))"; }

# Even batches, not greedy ones. Filling each batch to the disk maximum leaves
# a ragged tail — 20 evals at a ceiling of 9 gives 9/9/2, and that last
# invocation pays the full fixed overhead of a batch to run two evals. Spending
# the same number of invocations on 7/7/6 is strictly better: same wall clock,
# lower peak (14G against 18G), so the reserve grows for free.
#
# Recomputed against what is left rather than the original total, so a mid-run
# shrink in available disk re-balances the remainder instead of compounding.
planned_size() {
  local remaining="$1" max_fit="$2" count
  count=$(( (remaining + max_fit - 1) / max_fit ))
  [ "$count" -lt 1 ] && count=1
  printf '%s\n' "$(( (remaining + count - 1) / count ))"
}

newest_run() { ls -d results/"$1"/*/*/ 2>/dev/null | sort | tail -1; }

# Whether a batch finished is not what `agent-eval` reports in its exit code.
# It exits 1 when any eval scored below 100%, which for this campaign is the
# normal case and the entire point: `cc-none` exists to fail the tasks the MCP
# arms are supposed to pass. Gating on that status would stop the run on batch
# one of arm one, every time, having spent the money and kept the data.
#
# So completeness is checked against the artefacts instead. A batch is done
# when it wrote a *new* timestamped run directory containing a summary for
# every eval it was asked to run, each with its full complement of runs. That
# separates the two failures the exit code fuses together: trials that ran and
# scored badly (data) from trials that never ran at all (broken setup).
verify_batch() {
  local arm="$1" before="$2"; shift 2
  local run_dir eval_name total incomplete=0

  run_dir="$(newest_run "$arm")"
  if [ -z "$run_dir" ] || [ "$run_dir" = "$before" ]; then
    printf 'no new run directory under results/%s — the batch never started\n' "$arm" >&2
    return 1
  fi

  for eval_name in "$@"; do
    total="$(sed -n 's/.*"totalRuns"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' \
      "$run_dir$eval_name/summary.json" 2>/dev/null | head -1)"
    if [ "${total:-0}" -ne "$RUNS" ]; then
      printf '  %s: %s of %s run(s)\n' "$eval_name" "${total:-0}" "$RUNS" >&2
      incomplete=1
    fi
  done

  [ "$incomplete" -eq 0 ] || printf 'incomplete batch under %s\n' "$run_dir" >&2
  return "$incomplete"
}

free_now="$(free_gb)"
max_fit="$(batch_size "$free_now")"
batch_now="$(planned_size "${#EVALS[@]}" "${max_fit:-1}")"

printf '%s arm(s) × %s eval(s) × %s run(s) = %s trials\n' \
  "${#ARMS[@]}" "${#EVALS[@]}" "$RUNS" \
  "$(( ${#ARMS[@]} * ${#EVALS[@]} * RUNS ))"
printf 'free %sG · reserve %sG · %s sandbox(es) per eval at %s.%sG each\n' \
  "$free_now" "$FLOOR_GB" "$RUNS" \
  "$(( SANDBOX_TENTHS / 10 ))" "$(( SANDBOX_TENTHS % 10 ))"
printf 'ceiling %s eval(s), balanced to %s → %sG peak, %sG left\n\n' \
  "$max_fit" "$batch_now" "$(peak_gb "$batch_now")" \
  "$(( free_now - $(peak_gb "$batch_now") ))"

if [ "$max_fit" -lt "$MIN_BATCH" ]; then
  printf 'not enough disk: %sG free against a %sG reserve.\n' "$free_now" "$FLOOR_GB" >&2
  printf 'reclaim first — `pnpm results:prune --apply`, `docker system prune`.\n' >&2
  exit 1
fi

if [ "$APPLY" -eq 0 ]; then
  for arm in "${ARMS[@]}"; do
    i=0
    while [ "$i" -lt "${#EVALS[@]}" ]; do
      size="$(planned_size "$(( ${#EVALS[@]} - i ))" "$max_fit")"
      batch=("${EVALS[@]:i:size}")
      printf 'EVAL_ONLY=%s pnpm eval %s --force\n' \
        "$(IFS=,; printf '%s' "${batch[*]}")" "$arm"
      i=$(( i + size ))
    done
  done
  printf '\ndry run — nothing spent. re-run with --apply.\n'
  exit 0
fi

for arm in "${ARMS[@]}"; do
  i=0
  while [ "$i" -lt "${#EVALS[@]}" ]; do
    # Re-measured per batch: the results tree grows as the campaign runs, so a
    # batch size that cleared the reserve an hour ago may not clear it now.
    free_now="$(free_gb)"
    max_fit="$(batch_size "$free_now")"

    if [ "$max_fit" -lt "$MIN_BATCH" ]; then
      printf '\nstopping: %sG free, below the %sG reserve.\n' "$free_now" "$FLOOR_GB" >&2
      printf 'completed evals are kept — the report resolves per eval, so this\n' >&2
      printf 'is a pause, not a loss. reclaim disk and resume with:\n' >&2
      printf '  pnpm campaign:split --apply --arms %s\n' "$arm" >&2
      exit 1
    fi

    size="$(planned_size "$(( ${#EVALS[@]} - i ))" "$max_fit")"
    batch=("${EVALS[@]:i:size}")
    joined="$(IFS=,; printf '%s' "${batch[*]}")"

    printf '\n=== %s · evals %s-%s of %s · %sG free ===\n' \
      "$arm" "$(( i + 1 ))" "$(( i + ${#batch[@]} ))" "${#EVALS[@]}" "$free_now"

    before_run="$(newest_run "$arm")"
    EVAL_ONLY="$joined" pnpm eval "$arm" --force

    if ! verify_batch "$arm" "$before_run" "${batch[@]}"; then
      printf '\nbatch incomplete on %s. stopping rather than spending into a\n' "$arm" >&2
      printf 'broken setup. resume with:\n  EVAL_ONLY=%s pnpm eval %s --force\n' \
        "$joined" "$arm" >&2
      exit 1
    fi

    i=$(( i + ${#batch[@]} ))
  done
done

printf '\ncampaign complete. next: pnpm report && pnpm report:index\n'
