#!/usr/bin/env bash
# Build all the images needed by the Helm chart and push them to your registry.
# Works with any registry that `docker push` accepts: GCR, ACR, ECR, Docker Hub, ghcr.io.
#
# Usage:
#   REGISTRY=ghcr.io/your-org TAG=v0.1.0 ./infra/k8s/build-and-push.sh
#   REGISTRY=gcr.io/your-project ./infra/k8s/build-and-push.sh   # GKE / Artifact Registry
#   REGISTRY=youracr.azurecr.io ./infra/k8s/build-and-push.sh    # AKS
#   REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com ./infra/k8s/build-and-push.sh  # EKS
#
# Optional:
#   MCPS="pubmed clinicaltrials fda"   # only build these (default: read mcps-all.txt)
#   PLATFORM=linux/amd64                # default linux/amd64; use linux/arm64,linux/amd64 for multi-arch
#   PARALLEL=4                          # concurrent MCP builds
set -euo pipefail

REGISTRY="${REGISTRY:?REGISTRY env var is required, e.g. ghcr.io/your-org}"
TAG="${TAG:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
PARALLEL="${PARALLEL:-4}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "▶ building backend"
docker buildx build --platform "$PLATFORM" --push \
  -f backend/Dockerfile -t "$REGISTRY/backend:$TAG" .

echo "▶ building frontend"
docker buildx build --platform "$PLATFORM" --push \
  -f frontend/Dockerfile -t "$REGISTRY/frontend:$TAG" ./frontend

# MCP list
if [ -z "${MCPS:-}" ]; then
  MCPS="$(cat infra/helm/babagemed/mcps-all.txt | tr '\n' ' ')"
fi

echo "▶ building $(echo "$MCPS" | wc -w) MCP images with parallelism=$PARALLEL"
build_one() {
  local id="$1"
  echo "  → mcp-$id"
  docker buildx build --platform "$PLATFORM" --push \
    -f "mcps/$id/Dockerfile" -t "$REGISTRY/mcp-$id:$TAG" . 2>&1 | sed "s/^/    [$id] /"
}
export -f build_one
export REGISTRY TAG PLATFORM
echo "$MCPS" | tr ' ' '\n' | xargs -I{} -P "$PARALLEL" bash -c 'build_one "$@"' _ {}

echo "✓ done. all images at $REGISTRY/<name>:$TAG"
