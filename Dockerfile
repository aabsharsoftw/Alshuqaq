# ---------- Stage 1: build ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Install all deps (incl. dev) for building + prisma generate
COPY package*.json ./
RUN npm ci

# Generate Prisma client, then compile TypeScript
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Compile the admin seed script to plain JS so it can run without ts-node
RUN npx tsc prisma/seed.ts --outDir dist/seed --module commonjs \
    --target ES2021 --esModuleInterop --skipLibCheck

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Prisma needs the schema + generated client at runtime
COPY prisma ./prisma
RUN npx prisma generate

# Compiled app + compiled seed
COPY --from=builder /app/dist ./dist

# Entrypoint applies migrations then starts the server
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
