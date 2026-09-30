# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Vite writes VITE_* into the JavaScript bundle at build time, so they are
# build arguments. The App Key ends up in the browser anyway (see README).
ARG VITE_API_BASE_URL
ARG VITE_APP_ID
ARG VITE_APP_KEY
RUN test -n "$VITE_API_BASE_URL" && test -n "$VITE_APP_ID" && test -n "$VITE_APP_KEY" \
  || (echo "VITE_API_BASE_URL, VITE_APP_ID and VITE_APP_KEY are required" && exit 1)
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_ID=$VITE_APP_ID \
    VITE_APP_KEY=$VITE_APP_KEY
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
# The official image renders /etc/nginx/templates/*.template into /etc/nginx/conf.d
# with envsubst at start. The .inc file is not auto-loaded; server blocks include it.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.inc.template /etc/nginx/templates/security-headers.inc.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV PORT=9002
EXPOSE 9002
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
