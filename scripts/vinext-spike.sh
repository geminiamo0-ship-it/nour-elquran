#!/usr/bin/env bash
# CORE-02 #40: non-deploying, disposable CI compatibility probe.
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "Run only in an isolated GitHub Actions checkout; vinext init mutates local files." >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
report_dir="${RUNNER_TEMP}/noor-vinext-spike"
mkdir -p "$report_dir"
cd "$repo_root/apps/web"

# The probe route is created in the ephemeral CI checkout only, never committed
# or deployed. It checks server-side request cookies without storing user data.
mkdir -p src/app/api/__vinext_probe
cat > src/app/api/__vinext_probe/route.ts <<'ROUTE'
import { cookies } from 'next/headers';

export async function GET(): Promise<Response> {
  const jar = await cookies();
  return Response.json(
    { cookieSeen: jar.get('noor_spike')?.value === 'synthetic' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
ROUTE

echo "vinext 1.3.1 compatibility scanner (diagnostic, not an acceptance pass)"
set +e
pnpm dlx vinext@1.3.1 check > "$report_dir/check.log" 2>&1
scan_status=$?
set -e
cat "$report_dir/check.log"
printf 'vinext check exit: %s\n' "$scan_status" | tee "$report_dir/result.txt"

# No deploy, no cloud account, no secrets. Changes stay inside this CI job.
pnpm dlx vinext@1.3.1 init --platform=cloudflare --name noor-vinext-spike --skip-check
pnpm install --no-frozen-lockfile
pnpm run build:vinext

# Local production server is NOT proof of real Cloudflare Workers runtime.
pnpm exec vite preview --host 127.0.0.1 --port 3137 --strictPort > "$report_dir/server.log" 2>&1 &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT

ready=0
for attempt in $(seq 1 45); do
  if curl --silent --fail http://127.0.0.1:3137/ > "$report_dir/home.html"; then
    ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  cat "$report_dir/server.log"
  echo "vinext production server did not become ready" >&2
  exit 1
fi

grep -q 'dir="rtl"' "$report_dir/home.html"
grep -q 'lang="ar"' "$report_dir/home.html"
curl --fail --silent --show-error http://127.0.0.1:3137/student > "$report_dir/student.html"
grep -q 'dir="rtl"' "$report_dir/student.html"

curl --fail --silent --show-error \
  -H 'Cookie: noor_spike=synthetic' \
  http://127.0.0.1:3137/api/__vinext_probe > "$report_dir/cookie.json"
node -e 'const fs=require("node:fs");const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(data.cookieSeen!==true)process.exit(1)' "$report_dir/cookie.json"
curl --fail --silent --show-error \
  http://127.0.0.1:3137/api/__vinext_probe > "$report_dir/no-cookie.json"
node -e 'const fs=require("node:fs");const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(data.cookieSeen!==false)process.exit(1)' "$report_dir/no-cookie.json"

printf 'vinext build and local SSR/RTL/cookie probe: PASS\n' | tee -a "$report_dir/result.txt"
echo 'Worker runtime, bindings, streaming, auth verification and staging deployment: NOT TESTED' | tee -a "$report_dir/result.txt"
