# syntax=docker/dockerfile:1
# Multi-stage build: compile the frontend + bundle the API, then ship a slim runtime
# that serves the SPA from the API and runs DB migrations on start.

# ---------- Build stage ----------
FROM node:22 AS build
WORKDIR /app

# Install deps using the lockfile + workspace manifests (better layer caching).
COPY package.json package-lock.json ./
COPY app/package.json app/package.json
COPY server/package.json server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# Copy the rest of the monorepo and build.
COPY . .
RUN cd server && npx prisma generate
RUN npm --workspace app run build
RUN npm --workspace server run build

# ---------- Runtime stage ----------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
# Prisma needs openssl at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Bring over installed deps (incl. generated Prisma client + prisma CLI) and build output.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/app/dist ./app/dist

ENV STATIC_DIR=/app/app/dist
ENV PORT=4000
EXPOSE 4000

WORKDIR /app/server
# Applies pending migrations, then starts the API (which also serves the SPA).
CMD ["npm", "run", "start:prod"]
