#!/usr/bin/env bash
# Docker HEALTHCHECK durumu "healthy" olana kadar bekler (en fazla 120 sn).
set -euo pipefail
name="$1"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$name")"
  if [ "$status" = healthy ]; then
    echo "$name: healthy"
    exit 0
  fi
  sleep 2
done
echo "$name: sağlık durumu '$status' kaldı" >&2
docker logs "$name" 2>&1 | tail -30 >&2
exit 1
