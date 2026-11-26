# syntax=docker/dockerfile:1

# The context is the repository root. `npm run build` type-checks the tests
# too, so a type error fails the image, and they import testdata/numbers.json.
# Dockerfile.dockerignore keeps the context to frontend/ and that one file.

FROM node:24.22.3-alpine3.24 AS build
WORKDIR /src/frontend
# Dependencies first, so editing the source does not reinstall them.
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY testdata/numbers.json /src/testdata/numbers.json
COPY frontend/ ./
RUN npm run build
# Swagger UI for /docs/, with its licence files. The standalone preset and the
# source maps are left out.
RUN mkdir dist/docs && \
    cp node_modules/swagger-ui-dist/swagger-ui.css \
       node_modules/swagger-ui-dist/swagger-ui-bundle.js \
       node_modules/swagger-ui-dist/swagger-ui-bundle.js.LICENSE.txt \
       node_modules/swagger-ui-dist/favicon-32x32.png \
       node_modules/swagger-ui-dist/LICENSE \
       node_modules/swagger-ui-dist/NOTICE \
       api-docs/index.html api-docs/init.js \
       dist/docs/

# Runs as user 101 on port 8080, so it needs no root or capabilities. Compose
# makes the filesystem read-only and mounts /tmp, where nginx writes, as a tmpfs.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Its own directory, so the base image's sample pages are not served.
COPY --from=build /src/frontend/dist /usr/share/nginx/calculator
EXPOSE 8080
# The base image's default, written out because SIGTERM would drop in-flight
# requests and SIGQUIT lets nginx finish them.
STOPSIGNAL SIGQUIT
# nginx is PID 1 and gets the stop signal itself. Skipping the base image's
# entrypoint scripts, which edit the config at start, means the config that
# runs is exactly nginx.conf.
ENTRYPOINT ["nginx", "-g", "daemon off;"]
