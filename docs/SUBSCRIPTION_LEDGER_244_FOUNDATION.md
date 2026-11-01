# #244 — Monthly subscriptions: academic-credit ledger foundation (0026)

## Delivery boundary

This slice creates **no subscription purchase or renewal flow**, payment integration, admin page, paid booking, billing status or public credit-minting endpoint. It introduces a D1-only append-only entitlement schema, a signed learner-owner READ endpoint, and SQL/TS regression tests. All credits represent lesson units; no prices or money are stored. **`bookingEnabled:false` is deliberate** until the full paid booking + cancellation + financial confirmation workflow is independently reviewed and Dev tested.

## User-approved academic policy encoded now

- One distinct learner profile has its own entitlement cycles; siblings share only the account login, never a ledger.
- A manually approved cycle has BASE lessons, starts at activation and ends **one calendar month** later. This slice stores timestamps and enforces only a 27–32-day defensive bound: the **Africa/Cairo exact calendar-month calculation is still a precondition for the future writer**, not something this D1 schema falsely guarantees.
- Early overlapping renewals are currently denied; prepaid future renewals need separate approved design and UI. Renewal after the previous cycle ends is explicit, never automatic.
- Renew no later than **three days after expiry** to carry unspent BASE units exactly once. Renew after grace: zero carry. Previous rolled units **never roll again**. Spending is attributed to carried units first for rollover computation. Cycle debit events are restricted to the cycle and frozen after its successor, preventing retroactive credit inflation.
- Teacher/academy fault compensation grants are staff-reviewed and backed by a real cancelled/completed lesson. They **never expire**; SQL checks remaining units before each spend. A grant can only be debited **before the target lesson starts** and after the grant was issued, preventing retroactive use against historical lessons. No machine inference of fault.
- All D1 INSERTs re-check staff `roles.manage` grant, verified staff identity, active owner/learner and same-learner lesson references at commit time. SQL audit rows are immutable. Idempotent operation identifiers are UNIQUE; the future staff writer must implement exact-payload replay without ever changing audit events.
- Existing `staff/schedule-actions` can create `standard` lessons without this ledger. **That route is NOT connected to paid entitlement reservations by 0026**, so no payment/booking feature can be claimed complete yet.

## Read route

`GET /v1/me/learners/:learnerId/subscription-ledger`

Only a signed Better Auth household owner sees factual `latestCycle`, `compensationUnspentSessions`, `compensationGrantCount`. Historical credits are not shown as money. All responses include `bookingEnabled:false`; empty ledger is `latestCycle:null` and zero lifetime grants, not a fabricated payment or subscription. Wrong owner returns 404, not another household's data. Wrong HTTP method 405, schema not applied 503.

## Verification and subsequent steps

1. Apply all D1 migrations in order through native local Wrangler + Python SQLite. Prove no accidental money, duplicate/overlapping cycles, >balance debit, owner mismatch, staff grant revoked, 3-day grace, no second-generation rollover and immutable compensation.
2. CI must pass at the exact PR head. **No remote Dev migration until independently reviewed source and a scoped signed Dev run**. Do not deploy to Production.
3. Future #244 slices: Cairo-calendar exact-month writer + validated package catalog/pricing approval, independently reviewed staff activation with explicit manual verified receipt, per-lesson paid slot reservation/debit/refund/exception audit, student real subscriptions page, teacher schedule capacity, staff controls/permissions, 2-household Dev E2E, payment provider/consent only after owner chooses it.
4. Admin Dashboard is built **last**, per the approved sequencing. Do not fake paid statuses or available bookings in its interim screens.

