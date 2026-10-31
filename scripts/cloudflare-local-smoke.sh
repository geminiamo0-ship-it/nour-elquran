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
if ! grep -q 'NATIVE_DRAFT_WRITE_OK' "$state/draft-smoke.log" || \
   ! grep -q 'NATIVE_DRAFT_PUBLICATION_OK' "$state/draft-smoke.log"; then
  echo "Native D1 draft write/publication did not return the expected confirmations" >&2
  exit 1
fi

# Issue #286: native D1 must reject malformed colors and leave no draft row.
# This deliberately failing fixture uses synthetic IDs only.
echo "Checking native D1 rejects invalid teacher ink color (synthetic only)"
if "${wrangler[@]}" d1 execute noor-core-local --local --persist-to "$state" \
  --file ../../scripts/fixtures/teacher-draft-native-d1-invalid-color.sql > "$state/draft-invalid.log" 2>&1; then
  echo "Native D1 unexpectedly accepted an invalid teacher ink color" >&2
  exit 1
fi
if ! grep -q 'DRAFT_MARKS_INVALID' "$state/draft-invalid.log"; then
  echo "Native D1 invalid color failed for an unexpected reason" >&2
  exit 1
fi
"${wrangler[@]}" d1 execute noor-core-local --local --persist-to "$state" \
  --command "SELECT CASE WHEN (SELECT count(*) FROM teacher_assignment_draft_versions WHERE draft_id='f145a6fa-1d94-4994-91e7-5819692ba3b6')=0 THEN 'NATIVE_DRAFT_INVALID_COLOR_REJECTED' ELSE 'NATIVE_DRAFT_INVALID_COLOR_PERSISTED' END AS result" > "$state/draft-invalid-check.log"
if ! grep -q 'NATIVE_DRAFT_INVALID_COLOR_REJECTED' "$state/draft-invalid-check.log"; then
  echo "Native D1 invalid color left an unexpected draft row" >&2
  exit 1
fi

# #286: SQLite NULL must not bypass the required mark-color guard.
echo "Checking native D1 rejects omitted teacher ink color (synthetic only)"
if "${wrangler[@]}" d1 execute noor-core-local --local --persist-to "$state" \
  --file ../../scripts/fixtures/teacher-draft-native-d1-missing-color.sql > "$state/draft-missing-color.log" 2>&1; then
  echo "Native D1 unexpectedly accepted a missing teacher ink color" >&2
  exit 1
fi
if ! grep -q 'DRAFT_MARKS_INVALID' "$state/draft-missing-color.log"; then
  echo "Native D1 missing color failed for an unexpected reason" >&2
  exit 1
fi
"${wrangler[@]}" d1 execute noor-core-local --local --persist-to "$state" \
  --command "SELECT CASE WHEN (SELECT count(*) FROM teacher_assignment_draft_versions WHERE draft_id='e145a6fa-1d94-4994-91e7-5819692ba3b6')=0 THEN 'NATIVE_DRAFT_MISSING_COLOR_REJECTED' ELSE 'NATIVE_DRAFT_MISSING_COLOR_PERSISTED' END AS result" > "$state/draft-missing-color-check.log"
if ! grep -q 'NATIVE_DRAFT_MISSING_COLOR_REJECTED' "$state/draft-missing-color-check.log"; then
  echo "Native D1 missing color left an unexpected draft row" >&2
  exit 1
fi

# #286: canonical learner ledger uses the same D1-safe color guard as drafts.
# A malformed self-study event must fail without an event or current projection.
echo "Checking native D1 rejects invalid canonical Quran ink color (synthetic only)"
if "${wrangler[@]}" d1 execute noor-core-local --local --persist-to "$state" \
  --file ../../scripts/fixtures/learner-quran-native-d1-invalid-color.sql > "$state/ledger-invalid.log" 2>&1; then
  echo "Native D1 unexpectedly accepted an invalid canonical ink color" >&2
  exit 1
fi
if ! grep -q 'QURAN_LEDGER_PAYLOAD_DENIED' "$state/ledger-invalid.log"; then
  echo "Native D1 canonical invalid color failed for an unexpected reason" >&2
  exit 1
fi
"${wrangler[@]}" d1 execute noor-core-local --local --persist-to "$state" \
  --command "SELECT CASE WHEN (SELECT count(*) FROM learner_quran_events WHERE id='native-invalid-canonical-event')=0 AND (SELECT count(*) FROM learner_quran_current WHERE item_id='native-invalid-canonical-item')=0 THEN 'NATIVE_LEDGER_INVALID_COLOR_REJECTED' ELSE 'NATIVE_LEDGER_INVALID_COLOR_PERSISTED' END AS result" > "$state/ledger-invalid-check.log"
if ! grep -q 'NATIVE_LEDGER_INVALID_COLOR_REJECTED' "$state/ledger-invalid-check.log"; then
  echo "Native D1 invalid canonical ink left an unexpected event or projection" >&2
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
