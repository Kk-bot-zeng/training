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

# A misplaced route layout can still compile, but it nests the learner shell
# around the admin shell and causes repeated auth redirects/flicker. Refuse to
# publish a release unless every layout is in its intended scope.
grep -q 'function RootLayout' src/app/layout.tsx
if grep -Eq 'admin-shell|portal-shell' src/app/layout.tsx; then
  echo "Invalid root layout: route shell found in src/app/layout.tsx" >&2
  exit 1
fi
grep -q 'className="admin-shell"' src/app/admin/layout.tsx
grep -q 'className="portal-shell"' src/app/portal/layout.tsx

set -a
. ./.env.production
set +a
npx next build

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
