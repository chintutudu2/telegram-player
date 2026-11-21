# syntax=docker/dockerfile:1
# Production image for the Next.js app (standalone output).
# Build via docker compose, which mounts .env as a build secret so
# NEXT_PUBLIC_* values are inlined without baking secrets into image layers.

FROM node:24-alpine AS deps
WORKDIR /app
# Native addons (e.g. bufferutil, via GramJS) have no prebuilt binaries for
# Alpine on arm64 (Oracle Ampere), so npm compiles them. Build stage only.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Catalog pages are prerendered at build time, so Firebase keys are needed here.
RUN --mount=type=secret,id=dotenv,target=/app/.env npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HOME=/tmp
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /app/scripts ./scripts
USER node
EXPOSE 3000
CMD ["node", "server.js"]
