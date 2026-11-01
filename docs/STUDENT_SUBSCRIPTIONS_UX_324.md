# #324 — Minimal, truthful student subscriptions and homepage reflection

**Status:** Source candidate in PR #325, owner visual review and exact-head CI required before merge.

## Owner requirements
Keep package selection, academic session balance, requests and homepage status **clear without verbose admin/billing labels**. Home has only one narrow subscription strip; full page has one large status, clean catalog and optional request history. Student account, siblings and Mushaf are unchanged.

## Data trust contracts
- D1 `GET /v1/me/learners/:learnerId/subscription-ledger` is learner-scoped and read-only, with `bookingEnabled:false`; `latestCycle` recorded-unspent units and end date are **academic facts, not available-to-book paid credits, receipts or automatic renewal**.
- `GET /v1/me/learners/:learnerId/academy` returns active catalog versions, request state and academy WhatsApp. Client parser `features/shared/academy-owner-client.ts` verifies bounded fields and phone digits before display. Failed reads show a safe error, never invented zero or paid state.
- `POST /v1/me/learners/:learnerId/academy` sends operationId UUID + packageId only. One pending request disables duplicate; uncertain response blocks subsequent POST until a confirmed GET refresh. Client never issues a credit grant.
- External WhatsApp link contains only a generic academy message, **no learner name/identifier or private record**.
- In authenticated Home the strip uses an independent bounded Promise.allSettled (ledger + academy), never blocks lesson/task/report. `/preview/student/subscription` is explicitly non-auth illustration and has no API or payment action.
- Admin `/admin/packages` only collapses/organizes existing authorized list/add/edit/disable controls. It still requires explicit staff confirmation and keeps existing idempotency and D1 rules; all backend/payment/scheduling logic untouched.

## Main code
- `apps/web/src/features/student/components/StudentSubscription.module.css`: premium responsive tokens for catalog/status strip.
- `apps/web/src/features/student/components/{SubscriptionWorkspace,ConnectedSubscriptionLedger,ConnectedAcademyOffers,HomeSubscriptionStatus}.tsx`
- `apps/web/src/features/shared/{academy-owner-client.ts,index.ts}`, `StudentPremium` home integration, preview route.
- `apps/web/src/features/admin/{AdminAcademyMvp.tsx,AdminAcademyMvp.module.css}`.
- `apps/web/src/features/student/components/StudentSubscription.test.tsx` verifies parser, demo, signed loading and no fabricated paid status.

## Acceptance / follow-on
Exact-head CI and Cloudflare preview must pass. Then inspect 360, 390, 1280 pixels and signed owner cases: a learner with no cycle, pending request, activated cycle, expired period, no published packages, WhatsApp absent, network-unknown POST and sibling swap. Do not merge or publish Production before visual acceptance. Follow-on backend subscription write/paid booking remains separately governed; this is a UI-only change.
