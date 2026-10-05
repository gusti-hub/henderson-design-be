#!/bin/bash
# deploy.sh — pull latest image and restart the BE container
# Run this on the server: bash deploy.sh
set -e

CONTAINER_NAME="hale-be-container"
IMAGE="registry.digitalocean.com/hale-project/backend-app:latest"
ENV_FILE="/root/hale-be.env"   # put credentials here on the server (never commit this file)

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Create it first — see hale-be.env.template for the required keys."
  exit 1
fi

echo "==> Pulling latest image..."
docker pull "$IMAGE"

echo "==> Stopping old container (if running)..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true

echo "==> Removing old container (if exists)..."
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "==> Starting new container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 5000:5000 \
  --restart unless-stopped \
  --shm-size=256m \
  --env-file "$ENV_FILE" \
  -e CHROME_BIN=/usr/bin/chromium-browser \
  -e CHROME_PATH=/usr/lib/chromium/ \
  -e PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  -e PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  "$IMAGE"

echo "==> Done!"
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
