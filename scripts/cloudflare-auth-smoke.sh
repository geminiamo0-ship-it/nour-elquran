#!/usr/bin/env bash
# Synthetic, isolated local auth acceptance only. No remote commands or messages.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/workers/api"
state="$(mktemp -d "${TMPDIR:-/tmp}/noor-auth-native.XXXXXXXX")"
worker_pid=""
if [[ -e .dev.vars ]]; then echo "Refusing to overwrite existing local secrets" >&2; exit 1; fi
cleanup() {
  if [[ -n "$worker_pid" ]]; then kill "$worker_pid" 2>/dev/null || true; wait "$worker_pid" 2>/dev/null || true; fi
  rm -f .dev.vars
  rm -rf -- "$state"
}
trap cleanup EXIT
export WRANGLER_SEND_METRICS=false CI=true
umask 077
python3 - <<'PY'
import secrets
from pathlib import Path
Path('.dev.vars').write_text('AUTH_ENABLED=true\nAUTH_LOCAL_DEV=true\nAUTH_ORIGIN=http://127.0.0.1:8795\nAUTH_SECRET='+secrets.token_hex(32)+'\n')
PY
wrangler=(npx --yes wrangler@4.45.0)
"${wrangler[@]}" d1 migrations apply noor-core-local --local --persist-to "$state"
"${wrangler[@]}" dev --local --ip 127.0.0.1 --port 8795 --persist-to "$state" > "$state/worker.log" 2>&1 &
worker_pid=$!
healthy=0
for _ in $(seq 1 90); do
  if curl --silent --fail --max-time 1 http://127.0.0.1:8795/health >/dev/null; then healthy=1; break; fi
  if ! kill -0 "$worker_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [[ "$healthy" != 1 ]]; then
  # Wrangler hides .dev.vars values; redact any secret if a dependency prints it.
  python3 - "$state/worker.log" <<'PY'
import sys,re
from pathlib import Path
text=Path(sys.argv[1]).read_text()
for line in Path('.dev.vars').read_text().splitlines():
    if line.startswith('AUTH_SECRET='): text=text.replace(line.split('=',1)[1],'[REDACTED]')
print(text[-12000:])
PY
  exit 1
fi
cd "$root"
NOOR_AUTH_STATE="$state" node scripts/cloudflare-auth-smoke.mjs

