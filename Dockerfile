# Two stages so the runtime image carries no build toolchain and no dev
# dependencies — Vite, Tailwind and oxlint are needed to produce dist/ and
# are dead weight (and extra CVE surface) once it exists.

FROM node:22-alpine AS build
WORKDIR /app

# Copy manifests first: this layer only invalidates when dependencies
# actually change, so edits to src/ reuse the cached install.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only what the server actually reads at runtime: the built frontend, the
# API handlers, and the shared taxonomy they import.
COPY --from=build /app/dist ./dist
COPY api ./api
COPY shared ./shared
COPY server ./server

# Run unprivileged. The node image ships a `node` user for exactly this.
USER node

EXPOSE 3000
ENV PORT=3000 HOST=0.0.0.0

# No shell wrapper, so SIGTERM reaches Node directly and the graceful
# shutdown handler in server/index.mjs actually runs.
CMD ["node", "server/index.mjs"]
