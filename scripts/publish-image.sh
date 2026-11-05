#!/usr/bin/env bash
# ==============================================================================
# StayGames - Manual GHCR Container Build & Publish Script
# ==============================================================================
# Usage:
#   ./scripts/publish-image.sh [VERSION_TAG] [--skip-tests] [--platform PLATFORM]
#
# Examples:
#   ./scripts/publish-image.sh
#   ./scripts/publish-image.sh v1.1.0
#   ./scripts/publish-image.sh --skip-tests
#   PLATFORM=linux/amd64,linux/arm64 ./scripts/publish-image.sh
# ==============================================================================

set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/luanimadh/staygames}"
DEFAULT_PLATFORM="${PLATFORM:-linux/amd64}"
SKIP_TESTS=false
TAG_ARG=""

# Parse positional arguments and flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --platform)
      DEFAULT_PLATFORM="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [VERSION_TAG] [--skip-tests] [--platform PLATFORMS]"
      exit 0
      ;;
    *)
      if [[ -z "$TAG_ARG" ]]; then
        TAG_ARG="$1"
      fi
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')"
if [[ -n "$TAG_ARG" ]]; then
  VERSION_TAG="$TAG_ARG"
else
  VERSION_TAG="v$(node -p "require('./package.json').version" 2>/dev/null || echo '1.0.0')"
fi

echo "================================================================="
echo " StayGames - Container Publish to GHCR"
echo "================================================================="
echo " Target Image: ${IMAGE_NAME}"
echo " Version Tag:  ${VERSION_TAG}"
echo " Commit SHA:   ${GIT_SHA}"
echo " Platform:     ${DEFAULT_PLATFORM}"
echo "================================================================="

# ------------------------------------------------------------------------------
# 1. Run Tests and Typecheck (unless skipped)
# ------------------------------------------------------------------------------
if [[ "$SKIP_TESTS" = false ]]; then
  echo ""
  echo "==> Running Vitest test suite..."
  npm test

  echo "==> Running TypeScript typecheck..."
  npm run typecheck
  echo "✔ Verification passed!"
else
  echo "==> Skipping automated tests (--skip-tests active)."
fi

# ------------------------------------------------------------------------------
# 2. Check Docker Daemon & Permissions
# ------------------------------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  echo ""
  echo "✖ Error: Cannot connect to the Docker daemon socket."
  echo "  If your user is not in the 'docker' group, try running:"
  echo "    sudo usermod -aG docker \$USER"
  echo "  and log out and back in, or run this script with sudo."
  exit 1
fi

# ------------------------------------------------------------------------------
# 3. Authenticate to GitHub Container Registry (ghcr.io)
# ------------------------------------------------------------------------------
echo ""
echo "==> Authenticating to ghcr.io..."

# Priority 1: GITHUB_TOKEN or CR_PAT environment variable
TOKEN="${GITHUB_TOKEN:-${CR_PAT:-}}"
USERNAME="${GITHUB_ACTOR:-${GITHUB_USER:-}}"

# Priority 2: Use gh CLI token if available
if [[ -z "$TOKEN" ]] && command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    TOKEN="$(gh auth token 2>/dev/null || true)"
    if [[ -z "$USERNAME" ]]; then
      USERNAME="$(gh api user -q .login 2>/dev/null || true)"
    fi
  fi
fi

# Priority 3: Interactive prompt if running interactively
if [[ -z "$TOKEN" ]]; then
  if [[ -t 0 ]]; then
    echo "No GitHub Token found in environment or 'gh' CLI."
    read -rp "GitHub Username [luanimadh]: " input_user
    USERNAME="${input_user:-luanimadh}"
    read -rsp "GitHub Personal Access Token (classic with write:packages): " TOKEN
    echo ""
  else
    echo "✖ Error: GitHub token required. Set GITHUB_TOKEN or CR_PAT, or authenticate via 'gh auth login'."
    exit 1
  fi
fi

if [[ -z "$USERNAME" ]]; then
  USERNAME="luanimadh"
fi

echo "$TOKEN" | docker login ghcr.io -u "$USERNAME" --password-stdin
echo "✔ Successfully authenticated to ghcr.io as ${USERNAME}."

# ------------------------------------------------------------------------------
# 4. Build and Push Container Image
# ------------------------------------------------------------------------------
echo ""
echo "==> Building container image..."

# Use buildx if available for platform targeting and layer caching
if docker buildx version >/dev/null 2>&1; then
  echo "Using Docker Buildx for platform: ${DEFAULT_PLATFORM}..."
  docker buildx build \
    --platform "${DEFAULT_PLATFORM}" \
    --file Dockerfile \
    --tag "${IMAGE_NAME}:latest" \
    --tag "${IMAGE_NAME}:${VERSION_TAG}" \
    --tag "${IMAGE_NAME}:sha-${GIT_SHA}" \
    --push \
    .
else
  echo "Using standard Docker build..."
  docker build \
    -t "${IMAGE_NAME}:latest" \
    -t "${IMAGE_NAME}:${VERSION_TAG}" \
    -t "${IMAGE_NAME}:sha-${GIT_SHA}" \
    .

  echo "==> Pushing tags to GHCR..."
  docker push "${IMAGE_NAME}:latest"
  docker push "${IMAGE_NAME}:${VERSION_TAG}"
  docker push "${IMAGE_NAME}:sha-${GIT_SHA}"
fi

echo ""
echo "================================================================="
echo " 🎉 Successfully published image to GitHub Packages!"
echo "================================================================="
echo " Tags published:"
echo "   - ${IMAGE_NAME}:latest"
echo "   - ${IMAGE_NAME}:${VERSION_TAG}"
echo "   - ${IMAGE_NAME}:sha-${GIT_SHA}"
echo ""
echo " To test pulling anywhere:"
echo "   docker pull ${IMAGE_NAME}:latest"
echo "================================================================="
