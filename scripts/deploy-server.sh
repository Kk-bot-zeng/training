#!/usr/bin/env bash
set -euo pipefail

root=/srv/training-data
current="$root/app"
releases="$root/releases"
release="$releases/$(date +%Y%m%d-%H%M%S)"
resolved_current="$(readlink -f "$current")"

mkdir -p "$release"
rsync -a \
  --exclude=.next \
  --exclude=node_modules \
  --exclude=output \
  "$resolved_current/" "$release/"
cp -al "$resolved_current/node_modules" "$release/node_modules"

cd "$release"
set -a
. ./.env.production
set +a
npx next build

# Keep hashed assets from the previous version so pages opened before the
# deployment continue to work until users naturally refresh them.
if [ -d "$resolved_current/.next/static" ]; then
  rsync -a --ignore-existing "$resolved_current/.next/static/" "$release/.next/static/"
fi

ln -sfn "$release" "$root/app.next"
mv -Tf "$root/app.next" "$current"

pid="$(systemctl show training-app.service -p MainPID --value)"
kill "$pid"
for _ in $(seq 1 30); do
  if systemctl is-active --quiet training-app.service \
    && curl -fsS -o /dev/null http://127.0.0.1:3100/login; then
    echo "Deployment complete: $release"
    exit 0
  fi
  sleep 1
done

echo "Application did not become ready after deployment" >&2
exit 1
