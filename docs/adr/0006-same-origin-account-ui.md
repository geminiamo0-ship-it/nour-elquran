# ADR 0006: Same-origin static frontend and account API

Date: 2026-10-29  
Tracking: AUTH-02 #112, #43, #46  
Status: implementation choice; real-user rollout remains disabled

The approved static Next.js export remains the frontend. Root Worker composes `workers/site` with existing `workers/api`, sending explicit API paths to the maintained authentication handler and all other requests to the ASSETS binding. This permits same-origin HttpOnly cookies without cross-origin CORS/session credentials. Existing asset routes and branded 404 handling are retained. No SSR/framework migration or remote resource is implied.

`NEXT_PUBLIC_ACCOUNT_UI=true` is a public build-time presentation switch, absent by default. It cannot authorize any API. Server AUTH_ENABLED, secret, canonical trusted Origin and provisioned D1 binding remain independent. Root config contains no live D1 ID or secret. Disabling the UI and server flags rolls back exposure without deleting additive data.

Connected accounts load only server-owned learner DTOs, never browser demo names or fixtures. Learning services not yet implemented show empty states. Profile creation, registration, session lookup and logout use bounded existing backend contracts; no raw token enters JavaScript storage. Failed/expired sessions clear private views rather than return to demo. Async session leases prevent earlier results from restoring another session. Cross-tab session notifications contain no identity or credentials.

Account creation and the first profile are separate server operations: if the first profile response is lost, preserve the existing account and reload profiles before retrying. Do not repeat account registration or silently claim save success. Profile insertion failures with uncertain outcome require a list refresh before retry.

Acceptance is the actual local Chrome → static UI → Worker → Better Auth → D1 path, including a dropped successful profile response, reload, switching, account isolation, revocation and expiry. Existing default-demo checks stay mandatory. Phone verification/recovery, pre-registration abuse, adult/child/staff policy, remote staging and operational gates in #46 remain prerequisites for real-user rollout.

Primary routing reference: [Cloudflare Worker/assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) and [selective run_worker_first](https://developers.cloudflare.com/workers/static-assets/binding/#run_worker_first), checked 2026-10-29.
