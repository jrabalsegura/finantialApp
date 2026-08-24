FROM docker.io/library/node:22.23.2-bookworm-slim AS builder

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run prisma:generate

COPY app ./app
COPY src ./src
COPY middleware.ts next-env.d.ts next.config.mjs ./
COPY postcss.config.js tailwind.config.ts tsconfig.json ./

RUN DATABASE_URL=file:/tmp/build.db \
      AUTH_SECRET=container-build-placeholder-never-used-at-runtime \
      npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

FROM docker.io/library/node:22.23.2-bookworm-slim AS runtime

ARG APP_UID=10001
ARG APP_GID=10001

ENV HOME=/tmp \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid "${APP_GID}" financial-app \
    && useradd \
      --uid "${APP_UID}" \
      --gid "${APP_GID}" \
      --no-create-home \
      --shell /usr/sbin/nologin \
      financial-app \
    && install -d -o "${APP_UID}" -g "${APP_GID}" /app /data

WORKDIR /app

COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/package.json ./package.json
COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/node_modules ./node_modules
COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/.next ./.next
COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/prisma ./prisma
COPY --chown=${APP_UID}:${APP_GID} next.config.mjs ./next.config.mjs
COPY --chmod=0555 deploy/containers/entrypoint.sh /usr/local/bin/financial-app-entrypoint
COPY --chmod=0555 deploy/containers/healthcheck.mjs /usr/local/bin/financial-app-healthcheck.mjs

USER ${APP_UID}:${APP_GID}
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "/usr/local/bin/financial-app-healthcheck.mjs"]

STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/financial-app-entrypoint"]
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
