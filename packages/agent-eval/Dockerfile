# Serving a finished campaign.
#
# Unlike every other image in this repo, nothing here is *built* from source.
# The results tree is the output of paid model runs — it cannot be reproduced by
# a compiler, and CI does not have it either unless `pnpm results:download` has
# put it there. So the build copies `packages/agent-eval/results/` in, and
# `results/.gitkeep` is tracked so that a fresh clone has something to copy: an
# unpopulated deploy is an empty site, not a build failure.
#
# Populate it before deploying:
#   pnpm --filter agent-eval report build --all
#   pnpm --filter agent-eval report:index

# The only thing here that needs compiling is the auth library.
FROM node:24-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY patches/ ./patches/
COPY packages/shared-auth/package.json ./packages/shared-auth/

RUN pnpm install --frozen-lockfile --ignore-scripts \
      --filter @kickstartds/shared-auth

COPY packages/shared-auth/ ./packages/shared-auth/
RUN pnpm --filter @kickstartds/shared-auth run build

FROM node:24-slim AS production

LABEL org.opencontainers.image.source="https://github.com/kickstartDS/ruhmesmeile-storyblok-starter"
LABEL org.opencontainers.image.description="kickstartDS UI generation eval — campaign results"

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY patches/ ./patches/
COPY packages/agent-eval/package.json ./packages/agent-eval/
COPY packages/shared-auth/package.json ./packages/shared-auth/
COPY --from=builder /app/packages/shared-auth/dist ./packages/shared-auth/dist

# `--prod` matters more than it looks: agent-eval's devDependencies are
# Storybook, Vite and a Playwright browser driver. Serving the results does not
# require the ability to produce them.
#
# shared-auth is named explicitly. Filtering on `agent-eval` alone links the
# workspace package without installing *its* dependencies, and the container
# then starts and dies on `Cannot find package 'jsonwebtoken'` — at which point
# the gate is not open, it is absent.
RUN pnpm install --frozen-lockfile --ignore-scripts --prod \
      --filter agent-eval --filter @kickstartds/shared-auth

# Node 24 strips types natively, so the server runs from source. No build step,
# and so nothing that can fall out of sync with it.
COPY packages/agent-eval/server/ ./packages/agent-eval/server/

# The hand-grading queue. Unlike the results this *is* reproducible — it is
# derived from them by `pnpm calibration:export` — but it is derived on the
# machine that holds them, and shipping it is the entire point: a second rater
# needs the questions, not the 113 MB they came from.
#
# `calibration/labels/` is mounted over by a volume at runtime (see the Kamal
# config). Labels written through the web app are not in this image and must
# not be: they would be replaced by the next deploy.
COPY packages/agent-eval/calibration/ ./packages/agent-eval/calibration/

# Cache-bust: results change on every campaign, and nothing above them does.
# Kept last so re-publishing rebuilds exactly one layer.
ARG CACHEBUST=0
COPY packages/agent-eval/results/ ./packages/agent-eval/results/

ENV NODE_ENV=production
ENV PORT=8080
ENV RESULTS_DIR=/app/packages/agent-eval/results
ENV CALIBRATION_DIR=/app/packages/agent-eval/calibration

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/agent-eval/server/index.ts"]
