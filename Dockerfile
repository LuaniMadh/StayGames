# Stage 1: Build client and server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root manifest and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy full source
COPY tsconfig.json tsconfig.server.json ./
COPY shared ./shared
COPY server ./server
COPY client ./client

# Build React client and TypeScript server
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

LABEL org.opencontainers.image.source="https://github.com/LuaniMadh/StayGames"
LABEL org.opencontainers.image.description="StayGames game night platform with modular scorecards and LDAP authentication"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container health checks
RUN apk add --no-cache curl

# Copy production node_modules, compiled dist, and package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copy bundled plugins and ensure runtime write permissions for persistence
COPY plugins ./plugins
RUN chown -R node:node /app/plugins

# Non-root user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fs http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server/server/index.js"]
