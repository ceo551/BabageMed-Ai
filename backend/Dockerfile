# Build context is the repo root (see docker-compose.yml) so we can copy the manifest.
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum* ./
COPY backend/ .
# Tidy resolves any newly-required deps (e.g. golang.org/x/oauth2 added for
# the Vertex AI bearer-token path) and refreshes go.sum without needing it
# to be pre-computed locally.
RUN go mod tidy
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/backend .

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=build /out/backend /app/backend
COPY scripts/mcps.manifest.json /app/mcps.manifest.json
ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/backend"]
