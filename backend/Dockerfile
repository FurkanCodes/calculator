# syntax=docker/dockerfile:1

# Build a static binary. The cache mounts keep downloaded modules and the build
# cache between builds without putting them in any image layer.
FROM golang:1.27.4-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/calculator ./cmd/calculator

# Distroless static: no shell, no package manager, runs as a non-root user.
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/calculator /calculator
EXPOSE 8081
# Exec form, so the Go process is PID 1 and receives SIGTERM itself. A shell
# form would make /bin/sh PID 1, and it would not pass the signal on.
ENTRYPOINT ["/calculator"]
