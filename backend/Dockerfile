# Build context is the repo root (see docker-compose.yml).
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
# Download modules first so the layer caches when only source files change.
# We deliberately do NOT run `go mod tidy` at build time — that would let a
# registry compromise of a transitive dep silently land in every image, the
# exact thing go.sum was designed to prevent. The check below verifies the
# committed go.sum matches the modules on disk; CI fails the build on drift.
RUN go mod download -x && go mod verify
COPY backend/ .
RUN CGO_ENABLED=0 go build -mod=readonly -ldflags="-s -w" -o /out/backend .

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=build /out/backend /app/backend
ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
# No HEALTHCHECK directive — distroless has no shell or curl, and k8s
# readinessProbe (see infra/helm/.../templates/backend.yaml) already
# polls /health every 15 s, which is the source of truth for liveness.
ENTRYPOINT ["/app/backend"]
