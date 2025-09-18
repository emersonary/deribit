# ---- build ----
FROM node:20-alpine AS build
WORKDIR /repo

# copy manifests first for caching
COPY package*.json ./
COPY apps/node-app/package*.json apps/node-app/
COPY external/deribit-api-clients/typescript-node/package*.json external/deribit-api-clients/typescript-node/

# root deps (optional), app deps (what you had)
RUN if [ -f apps/node-app/package-lock.json ]; then \
  cd apps/node-app && npm ci ; \
  else \
  cd apps/node-app && npm install ; \
  fi

# bring in sources
COPY . .

# 1) build external SDK -> dist
RUN cd external/deribit-api-clients/typescript-node && \
  npm ci || true && \
  npx tsc -p tsconfig.json

# 2) build your app (it now imports SDK from dist/)
RUN cd apps/node-app && (npm run build || npx tsc)

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /repo/apps/node-app/package*.json ./
COPY --from=build /repo/external/deribit-api-clients/typescript-node/dist \
  /external/deribit-api-clients/typescript-node/dist
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY --from=build /repo/apps/node-app/dist ./dist
ENV NODE_PATH=/app/node_modules
EXPOSE 8080
CMD ["node", "dist/index.js"]
