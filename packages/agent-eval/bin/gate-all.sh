#!/usr/bin/env bash
# Gate every fixture with its gold reference applied. Zero spend.
# Reads the eval -> component-directory map from /tmp/eval-dirs.tsv.
set -u

cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"
OUT="/tmp/gate-all"
rm -rf "$OUT" && mkdir -p "$OUT"

while IFS=$'\t' read -r name dir; do
  [ -z "$name" ] && continue

  work="$OUT/$name"
  cp -r "$ROOT/evals/$name" "$work"

  ref="$ROOT/lib/eval-harness/reference/$name"
  if [ -d "$ref" ]; then
    mkdir -p "$work/$dir"
    cp "$ref"/* "$work/$dir"/ 2>/dev/null
  fi

  printf 'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { include: ["EVAL.ts"], environment: "node", testTimeout: 120000 } });\n' > "$work/vitest.config.ts"

  ( cd "$work" && npm install --silent --no-audit --no-fund >/dev/null 2>&1 )

  raw="$( cd "$work" && npx vitest run --reporter=basic 2>&1 \
    | grep -av -i -e debugger -e 'Waiting for' -e 'help, see' )"

  line="$( printf '%s\n' "$raw" | grep -E "^ *Tests +" | tail -1 )"
  printf '%-28s %s\n' "$name" "${line:-NO RESULT}"

  if printf '%s\n' "$line" | grep -q "failed"; then
    printf '%s\n' "$raw" | grep -E "^ +×" | head -6 | sed 's/^/      /'
  fi
done < /tmp/eval-dirs.tsv
