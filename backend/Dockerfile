# Backend — Sprint Auth.
# Same code and same env as npm dev; only the runner differs.
# Build needs network once (npm install + prisma generate). Runtime needs
# DATABASE_URL and JWT_SECRET from the Compose environment — no secret
# is baked into the image.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Prisma detects the OpenSSL version by running the `openssl` binary. The
# slim image does not ship it, so without this install Prisma defaults to
# the openssl-1.1.x engine, which cannot run on bookworm (libssl.so.1.1
# is absent). Install it before `prisma generate`.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Same OpenSSL reason as in the builder stage: the query/migration engines
# need libssl.so.3 at runtime, and Prisma's detection needs the binary.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Prisma Client (generated) + runtime deps travel with node_modules.
# Keeping dev deps out would need a second install; the simpler, less
# error-prone choice for a small shop is to copy the built tree as-is.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# The copied tree is root-owned, but the app runs as `node`. Without this,
# `prisma migrate dev` fails with "Can't write to
# /app/node_modules/@prisma/engines" and new migrations cannot be written
# to /app/prisma. The production image contains dist/ only (no src/), so
# seed runs as `node dist/seed.js`, never `npm run seed` (ts-node src/).
RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
