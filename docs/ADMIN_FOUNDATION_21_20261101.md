# ADM-01 #21 — signed, zero-mock Admin foundation

Scope: first safe implementation slice of the owner-requested Admin Dashboard.
This is not a production release. ADR 0008 still places full Admin
operations and payments after educational flows.

## Current code contract
- Static Next.js /admin contains no privileged data in HTML. Its client
  shell waits for the signed Better Auth account and a fresh same-origin
  GET /v1/staff/capabilities response. No local role/header/URL switch grants access.
- The Worker checks the signed session before the route and verifies active
  staff_grants, active account, non-revoked permission and verified phone
  in D1. Anonymous = 401; owner/teacher without staff grant = 403.
- The response exposes only manageTeachers and reviewAttendance booleans.
  It does not enumerate staff, learners, grants or financial data.
- Navigation is restricted to server-confirmed capabilities, but navigation
  is never a substitute for per-operation Worker authorization.
- All sections are honestly labelled as not yet connected. No fabricated
  dashboard statistics, no mutation, no payments, no child media.

## Required acceptance before merge / deployment
1. Exact-head lint, strict TS, backend tests, frontend parser tests, build
   and architecture gate green.
2. Independent review of SQL permission predicate and role mismatch:
   existing attendance.review API currently checks active account/grant but
   this new UI requires phone verification too (intentionally stricter).
3. Signed isolated Cloudflare Dev: staff with roles.manage, staff with
   attendance.review, owner, teacher, anonymous, revoked staff, inactive
   account and unverified phone; verify 200/401/403 and no private content.
4. Mobile RTL 360x667 / 390x844 and keyboard focus/accessible menu.
5. Do not enable Production or grant new staff privileges.

## Next
Implement bounded read-only attendance appeals and teacher invitation review
in separate linked issues/PRs after authorization tests. Full Admin stays open.
