# Backend — Sprint Auth.
# Same code and same env as npm dev; only the runner differs.
# Build needs network once (npm install + prisma generate). Runtime needs
# DATABASE_URL and JWT_SECRET from the Compose environment — no secret
# is baked into the image.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
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
# Prisma Client (generated) + runtime deps travel with node_modules.
# Keeping dev deps out would need a second install; the simpler, less
# error-prone choice for a small shop is to copy the built tree as-is.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
