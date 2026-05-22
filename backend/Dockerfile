# Build context is the repo root (see docker-compose.yml) so we can copy the manifest.
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum* ./
RUN go mod download || true
COPY backend/ .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/backend .

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=build /out/backend /app/backend
COPY scripts/mcps.manifest.json /app/mcps.manifest.json
ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/backend"]
