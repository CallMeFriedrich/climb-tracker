#!/bin/bash
# Climb Tracker – Safe Deploy Script
# Backs up the database before replacing the container.
set -e

IMAGE="ghcr.io/callmefriedrich/climb-tracker:latest"
CONTAINER="climb-tracker"
VOLUME="climb-tracker-data"
DATA_DIR="/var/lib/docker/volumes/${VOLUME}/_data"
BACKUP_DIR="${DATA_DIR}/backups"

echo "=== Climb Tracker Deploy ==="
echo "Pulling latest image..."
docker pull "$IMAGE"

# Backup database if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Backing up database..."
  mkdir -p "$BACKUP_DIR"
  TS=$(date +"%Y-%m-%dT%H-%M-%S")
  cp "${DATA_DIR}/app.db" "${BACKUP_DIR}/app-${TS}.db" 2>/dev/null && \
    echo "  Backup saved: ${BACKUP_DIR}/app-${TS}.db" || \
    echo "  Warning: backup skipped (no app.db yet)"

  # Keep only last 10 backups
  ls -t "${BACKUP_DIR}"/*.db 2>/dev/null | tail -n +11 | xargs rm -f

  echo "Stopping old container..."
  docker stop "$CONTAINER"
  docker rm "$CONTAINER"
else
  echo "No running container found, skipping backup."
  docker rm "$CONTAINER" 2>/dev/null || true
fi

echo "Starting new container..."
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "${VOLUME}:/app/data" \
  "$IMAGE"

echo "=== Done! ==="
docker ps --filter "name=${CONTAINER}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
