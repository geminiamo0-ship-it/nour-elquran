#!/usr/bin/env bash
# #46: isolated local Cloudflare runtime smoke; NEVER use --remote or deploy.
set -euo pipefail

cd "$(dirname "$0")/../workers/api"
state="$(mktemp -d "${TMPDIR:-/tmp}/noor-d1-native.XXXXXXXX")"
worker_pid=""
cleanup() {
  if [[ -n "$worker_pid" ]]; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  rm -rf -- "$state"
}
trap cleanup EXIT

# Explicitly pinned, no Cloudflare account/credentials, zero-ID local binding only.
wrangler=(npx --yes wrangler@4.45.0)
export WRANGLER_SEND_METRICS=false
export CI=true

echo "Applying D1 migration to disposable LOCAL state"
"${wrangler[@]}" d1 migrations apply noor-core-local --local --persist-to "$state"
echo "Checking migration is replay-safe in local Wrangler"
"${wrangler[@]}" d1 migrations apply noor-core-local --local --persist-to "$state"

# Issue #286: exercise the exact pen+highlight draft INSERT in native local D1,
# not Python's SQLite engine. Fixture is synthetic and this state is disposable.
echo "Checking native D1 teacher marked-homework write (synthetic only)"
"${wrangler[@]}" d1 execute noor-core-local --local --persist-to "$state" \
  --file ../../scripts/fixtures/teacher-draft-native-d1.sql > "$state/draft-smoke.log"
if ! grep -q 'NATIVE_DRAFT_WRITE_OK' "$state/draft-smoke.log"; then
  echo "Native D1 teacher draft write did not return the expected confirmation" >&2
  exit 1
fi

echo "Starting LOCAL Worker + D1 (no publish)"
"${wrangler[@]}" dev --local --ip 127.0.0.1 --port 8793 --persist-to "$state" > "$state/worker.log" 2>&1 &
worker_pid=$!

ready=0
for _ in $(seq 1 90); do
  if curl --silent --fail --max-time 1 http://127.0.0.1:8793/health > /dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$worker_pid" 2>/dev/null; then
    echo "Wrangler exited before becoming healthy" >&2
    cat "$state/worker.log" >&2
    exit 1
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo "Timed out waiting for local Worker" >&2
  cat "$state/worker.log" >&2
  exit 1
fi

node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8793';
async function probe(path, status, expected, init) {
  const response = await fetch(base + path, init);
  const body = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(body)}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(body.requestId && response.headers.get('x-request-id') === body.requestId);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(body[key], value, `${path}: ${key}`);
  }
  return body;
}
await probe('/health', 200, { service: 'noor-api', status: 'up' });
await probe('/ready', 503, { database: 'ready', code: 'AUTH_NOT_CONFIGURED' });
await probe('/readyz', 503, { database: 'ready', code: 'AUTH_NOT_CONFIGURED' });
await probe('/v1/learners/other/notebook', 503, { code: 'AUTH_NOT_CONFIGURED' }, {
  headers: { authorization: 'Bearer forged', 'x-user-id': 'other', cookie: 'session=forged' },
});
await probe('/v1', 503, { code: 'AUTH_NOT_CONFIGURED' }, { method: 'POST' });
await probe('/missing', 404, { code: 'NOT_FOUND' });
console.log('Native local Worker + D1 migration and fail-closed HTTP smoke passed');
NODE
