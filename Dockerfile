# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL=file:/tmp/vanguard-build.db

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

RUN node -e '\
  const { pipeline, env } = require("@huggingface/transformers"); \
  env.cacheDir = "./.cache/transformers"; \
  pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { dtype: "q8" }) \
    .then(() => console.log("ONNX weights cached successfully.")) \
    .catch((err) => { console.error(err); process.exit(1); });'

RUN npm run build

FROM node:22-slim AS prisma-cli
WORKDIR /cli

COPY package-lock.json ./
RUN PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
    && DOTENV_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/dotenv'].version")" \
    && npm install --no-audit --no-fund --no-save "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}"

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    TRANSFORMERS_CACHE=/app/.cache/transformers \
    DATABASE_URL=file:/data/pulse.db

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home nextjs

RUN mkdir -p /data /app/.cache/transformers \
    && chown -R nextjs:nodejs /data /app/.cache

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./node_modules

COPY --from=builder --chown=nextjs:nodejs /app/node_modules/onnxruntime-node ./node_modules/onnxruntime-node
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/onnxruntime-common ./node_modules/onnxruntime-common
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright-core/browsers.json ./node_modules/playwright-core/browsers.json

COPY --from=builder --chown=nextjs:nodejs /app/.cache/transformers ./.cache/transformers

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

