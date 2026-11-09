## 2026-11-07 — live cycle boundary labels without new server writes
- Source review found a long-open-tab bug: the D1 subscription GET computes `state` only once, while a future cycle may start or an active cycle may end before the guardian refreshes. Both connected Home and Subscription surfaces now schedule a single local render at the next signed start/end timestamp and recompute the period from signed dates. `state` remains a fallback only for legacy calls without `startsAtMs`.
- `subscription-boundary-clock.ts` clamps browser timer delays and cleans up on unmount/profile switch; no polling, D1 mutation, payment activation or credit change. `StudentSubscription.test.tsx` covers future → active → expired using the intentionally stale `state:'expired'` and timer edge cases.
- Exact-head CI for these changes must be checked. Signed Cloudflare Dev, two-sibling isolation, mobile 360/390 and independent privacy review remain OPEN; PR #325 stays Draft and overlaps PR #327.

## 2026-11-07 — #326 academy quote identifier contract (Draft PR #325)
- Source-only follow-up: the signed owner catalog parser now rejects non-UUID-v4 package/version IDs before showing the EGP price or request CTA. Previously it accepted `pkg-1`/`ver-1` even though the Worker POST requires UUID v4, leaving an impossible-to-submit displayed quote. `StudentSubscription.test.tsx` now covers malformed strings, wrong UUID version and array coercion for both IDs; valid synthetic UUID catalog remains supported.
- Code commits `045d58ffba08a754f72591104e763e7b83491904` and `d246b3cb06c1ce7b4b402b22a6b155bda83f9aa5`. This does NOT change D1 prices, package versions, activation, payments, or Production. Exact-head CI after documentation commits, independent security review and signed Cloudflare Dev owner/sibling/reprice acceptance are still required; keep #324/#326 OPEN and PR #325 Draft. Reconcile PR #327 overlap before any merge.
- NEXT: inspect latest exact-head GitHub Verify; if green, stage synthetic signed owner A/B catalog and stale quote, then obtain review/visual acceptance. No Production deploy.

## 2026-11-06 — #324 strict academy request-state parsing (Draft PR #325)
- Found another coercion gap distinct from the already-fixed cycle state: `String(r.state)` accepted JSON arrays like `["pending"]` from a malformed signed academy GET, but the returned request retained the array. `latestPendingAcademyRequest` would not recognize it, potentially showing a new package-request action despite a pending request.
- `academy-owner-client.ts` now requires the exact `pending|activated|rejected` string discriminant; `StudentSubscription.test.tsx` covers all three coerced-array variants and valid pending. Source commits `c3dd0cd65bd12834633b9bef6996cfdd3c7e4163` and `61abd05c15110d0911a0a06a5132ed58f954e03d`.
- Exact-head CI after these commits is not yet established. PR remains Draft, no Dev/Production change. Next: verify GitHub Actions on the final documentation HEAD, independent security review, reconcile #327 overlap, then signed Dev guardian/two-sibling quote/replay and mobile acceptance.

## 2026-11-06 — #324 strict subscription cycle-state DTO guard (Draft PR #325)
- Source review found `String(item.state)` accepted JSON arrays such as `['within_period']` as a valid cycle state, while returning the original array to the UI. That could make the signed balance appear expired/unknown despite a malformed successful response. The client now requires the exact string literal `within_period` or `expired`; regression tests cover array coercion and the valid string case.
- Source commits: `ffe3c30dc8a2b666d0fb9f1fc5e55d84342dce20`, `1252e002fd0b3aea7c41fe906658c14528efb200`. Previous exact-head Verify [#42234153319](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/42234153319) was green 4/4 on `ec91dd7714f4c4624966dd89a0fc9d239d50ad1b` **before** these commits. New exact-head CI not yet verified; source-only candidate, no Dev/Production changes.
- Next: inspect exact-head Verify, independently review privacy/financial quote safeguards, reconcile overlap with Draft #327, then signed Cloudflare Dev guardian/two-sibling/price-change tests and 360/390 mobile review before merge.

## 2026-11-03 — #326 safety extension (Draft PR #325)
The original UI-only scope exposed a source-proven quote race: an admin could reprice a package between the signed catalog GET and guardian POST. The POST previously carried only packageId, so the Worker could record a different immutable price than the one displayed. Linked Issue #326 extends this Draft candidate to require the displayed packageVersionId and enforce it in the **same atomic D1 INSERT**; stale/disabled versions return 409 without recording a request. An exact-operation replay remains bound to its original version. No pricing, credit or payment policy changed. Source CI and signed Dev acceptance are pending; keep both Issues open and do not merge based on this note.

# #324 — Minimal, truthful student subscriptions and homepage reflection

**Status:** Source candidate in PR #325, owner visual review and exact-head CI required before merge.

## Owner requirements
Keep package selection, academic session balance, requests and homepage status **clear without verbose admin/billing labels**. Home has only one narrow subscription strip; full page has one large status, clean catalog and optional request history. Student account, siblings and Mushaf are unchanged.

## Data trust contracts
- D1 `GET /v1/me/learners/:learnerId/subscription-ledger` is learner-scoped and read-only, with `bookingEnabled:false`; `latestCycle` recorded-unspent units and end date are **academic facts, not available-to-book paid credits, receipts or automatic renewal**.
- `GET /v1/me/learners/:learnerId/academy` returns active catalog versions, request state and academy WhatsApp. Client parser `features/shared/academy-owner-client.ts` verifies bounded fields and phone digits before display. Failed reads show a safe error, never invented zero or paid state.
- `POST /v1/me/learners/:learnerId/academy` sends an immutable operationId UUID, packageId **and the displayed packageVersionId**. The Worker checks that version at the atomic D1 insert boundary (#326); stale versions return 409, while same-operation replay retains the original quote. One pending request disables duplicates; uncertain results require replay of the same operationId, not a new request. Client never issues a credit grant.
- External WhatsApp link contains only a generic academy message, **no learner name/identifier or private record**.
- In authenticated Home the strip uses an independent bounded Promise.allSettled (ledger + academy), never blocks lesson/task/report. `/preview/student/subscription` is explicitly non-auth illustration and has no API or payment action.
- Admin `/admin/packages` organizes existing authorized list/add/edit/disable controls with explicit confirmation and D1 idempotency. This PR also contains the separately tracked #326 quote-version backend guard; it does **not** enable payment gateways, alter settlement policy or change scheduling.

## Main code
- `apps/web/src/features/student/components/StudentSubscription.module.css`: premium responsive tokens for catalog/status strip.
- `apps/web/src/features/student/components/{SubscriptionWorkspace,ConnectedSubscriptionLedger,ConnectedAcademyOffers,HomeSubscriptionStatus}.tsx`
- `apps/web/src/features/shared/{academy-owner-client.ts,index.ts}`, `StudentPremium` home integration, preview route.
- `apps/web/src/features/admin/{AdminAcademyMvp.tsx,AdminAcademyMvp.module.css}`.
- `apps/web/src/features/student/components/StudentSubscription.test.tsx` verifies parser, demo, signed loading and no fabricated paid status.

## Acceptance / follow-on
Exact-head CI and Cloudflare preview must pass. Then inspect 360, 390, 1280 pixels and signed owner cases: a learner with no cycle, pending request, activated cycle, expired period, no published packages, WhatsApp absent, network-unknown POST and sibling swap. Do not merge or publish Production before visual acceptance. Follow-on backend subscription write/paid booking remains separately governed; this is a UI-only change.

## Compensation-only truthfulness (2026-11-03)
`compensationUnspentSessions` belongs to the signed D1 academic ledger and may be nonzero with `latestCycle=null`. Both Home and Subscription show this count without fabricating a paid/active cycle or a booking right; pending renewal remains a secondary message. The academic-cycle remaining units and compensation units are displayed separately, never summed as available-to-book credits. Test with synthetic compensation-only and sibling records on Dev before acceptance.
