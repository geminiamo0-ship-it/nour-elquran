#!/usr/bin/env bash
# Isolated LOCAL full browser journey. No deployment, real users or messages.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
state="$(mktemp -d "${TMPDIR:-/tmp}/noor-auth-browser.XXXXXXXX")"
worker_pid=""
cleanup() {
  if [[ -n "$worker_pid" ]]; then kill "$worker_pid" 2>/dev/null || true; wait "$worker_pid" 2>/dev/null || true; fi
  rm -rf -- "$state"
}
trap cleanup EXIT
export WRANGLER_SEND_METRICS=false CI=true
umask 077
python3 - "$root" "$state" <<'PY'
import json,secrets,sys
from pathlib import Path
root,state=map(Path,sys.argv[1:])
w=json.loads((root/'wrangler.jsonc').read_text())
w.update(name='noor-account-browser-local',workers_dev=False,preview_urls=False)
w.pop('previews',None)
w['main']=str(root/w['main'])
w['assets']['directory']=str(root/'apps/web/out')
w['d1_databases']=[dict(binding='DB',database_name='noor-core-local',database_id='00000000-0000-0000-0000-000000000000',migrations_dir=str(root/'workers/api/migrations'))]
(state/'wrangler.json').write_text(json.dumps(w))
(state/'.dev.vars').write_text('AUTH_ENABLED=true\nAUTH_LOCAL_DEV=true\nAUTH_ORIGIN=http://127.0.0.1:8797\nAUTH_SECRET='+secrets.token_hex(32)+'\n')
PY
cd "$root"
wrangler=(npx --yes wrangler@4.45.0)
"${wrangler[@]}" d1 migrations apply noor-core-local --config "$state/wrangler.json" --local --persist-to "$state/d1"
"${wrangler[@]}" dev --config "$state/wrangler.json" --local --ip 127.0.0.1 --port 8797 --persist-to "$state/d1" > "$state/worker.log" 2>&1 &
worker_pid=$!
healthy=0
for _ in $(seq 1 90); do
  if curl --silent --fail --max-time 1 http://127.0.0.1:8797/health >/dev/null; then healthy=1; break; fi
  if ! kill -0 "$worker_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [[ "$healthy" != 1 ]]; then
  python3 - "$state" <<'PY'
import sys
from pathlib import Path
state=Path(sys.argv[1]);text=(state/'worker.log').read_text()
for line in (state/'.dev.vars').read_text().splitlines():
    if line.startswith('AUTH_SECRET='): text=text.replace(line.split('=',1)[1],'[REDACTED]')
print(text[-14000:])
PY
  exit 1
fi
command -v google-chrome
NOOR_BROWSER_CONFIG="$state/wrangler.json" NOOR_BROWSER_STATE="$state/d1" node scripts/cloudflare-auth-browser.mjs
