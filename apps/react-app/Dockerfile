# apps/react-app/Dockerfile
FROM node:20-alpine AS build
WORKDIR /web

# Copy manifest(s)
COPY package*.json ./

# Use lockfile if present, else install normally
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy rest and build
COPY . .
RUN npm run build

# --- nginx stage ---
FROM nginx:1.27-alpine
# Vite output is /dist
COPY --from=build /web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
