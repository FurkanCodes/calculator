# syntax=docker/dockerfile:1

# Build context: the repository root, not frontend/ (see docker-compose.yml).
# `npm run build` runs `tsc -b` before `vite build`, and the type check covers
# the tests too, which import ../../testdata/numbers.json from outside
# frontend/. Building with the same command as development and CI means a type
# error fails the image build. Dockerfile.dockerignore, next to this file,
# keeps the context to frontend/ and that one file; BuildKit applies it to this
# Dockerfile only.

# Build the static files.
FROM node:24.22.3-alpine3.24 AS build
WORKDIR /src/frontend
# Dependencies first, so editing the source does not reinstall them. The cache
# mount keeps npm's download cache between builds without putting it in a layer.
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY testdata/numbers.json /src/testdata/numbers.json
COPY frontend/ ./
RUN npm run build
# The API documentation, served at /docs/: Swagger UI's stylesheet, script and
# icon from the pinned swagger-ui-dist package, with its licence files, and the
# page that starts it on /api/v1/openapi.json. The standalone preset (a top bar
# for loading other documents) and the source maps are left out.
RUN mkdir dist/docs && \
    cp node_modules/swagger-ui-dist/swagger-ui.css \
       node_modules/swagger-ui-dist/swagger-ui-bundle.js \
       node_modules/swagger-ui-dist/swagger-ui-bundle.js.LICENSE.txt \
       node_modules/swagger-ui-dist/favicon-32x32.png \
       node_modules/swagger-ui-dist/LICENSE \
       node_modules/swagger-ui-dist/NOTICE \
       api-docs/index.html api-docs/init.js \
       dist/docs/

# nginx-unprivileged runs as user 101 and listens on 8080, so it needs no root
# and no capabilities. Its temp files and pid file live in /tmp, which Compose
# mounts as a tmpfs because the container's filesystem is read-only.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Its own directory, so the base image's sample pages are not served.
COPY --from=build /src/frontend/dist /usr/share/nginx/calculator
EXPOSE 8080
# The base image already stops with SIGQUIT, which is nginx's graceful
# shutdown: it stops accepting connections and finishes in-flight requests.
# SIGTERM would be a fast shutdown that drops them. Stated here so it is visible.
STOPSIGNAL SIGQUIT
# Exec form, so nginx is PID 1 and receives the stop signal itself. Starting
# nginx directly also skips the base image's docker-entrypoint.sh, whose
# scripts try to adjust the config at start (on a read-only filesystem they
# log and carry on). Without them, the config that runs is exactly this file.
ENTRYPOINT ["nginx", "-g", "daemon off;"]
