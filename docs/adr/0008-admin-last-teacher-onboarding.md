# ADR 0008 — Admin Dashboard is the final delivery program

Date: 2026-10-30 (Africa/Cairo)  
Status: owner-approved product sequencing, implementation not started  
Related: #155, #186, #45, #51, #120, #19.

## Decision

1. Finish the Student and Sheikh educational backend, reports, notebooks, training, audio privacy, notifications and their connected user interfaces before the Admin Dashboard.
2. Finish the real Classroom and its verified events/archival integration in a separate program before the final Admin Dashboard.
3. The **Admin Dashboard is built last**. It owns teacher invitations, reviewing applications/profiles, activation/suspension, learner-teacher assignment, booking, trial eligibility, packages, financial balances, payments, invoices, refunds and staff oversight. Student/Sheikh portals only read these server-authorized data and request permitted flows through agreed APIs. No duplicate booking, entitlement or staff authority.
4. Sheikh onboarding will use a **private single-use expiring invitation** issued by staff, leading to a dedicated Sheikh registration page (not student signup), collecting name, photograph, professional qualifications, Quran ijazat/riwayat, work experience, bio and optional private evidence. Cloudflare D1 stores the application; private R2 stores applicant media with explicit visibility and retention controls.
5. Completing the invited registration creates **pending review**, never an active qualified Sheikh role. Only staff can approve and activate after reviewing the application. Activating a Sheikh and assigning learners are distinct audited actions. Possession of the link, a successful signup or a photo upload cannot self-promote the account.
6. Until Admin Dashboard is built, isolated synthetic staff/teacher provisioning can be used in **Dev/test** with signed authorization and cleanup. No public admin endpoints, hardcoded staff actor, bypass of consent, Production activation, or pretend bookings.

## Current Phase 07 reports

- Report APIs are delivered independently of the future Admin UI: they accept a lesson only after the authorized **Classroom END** event has been recorded, and author is verified from the acting Sheikh assignment/grant. Tests use synthetic signed lesson records.
- Reports cannot authorize their own lesson completion or bookings. The administrator later consumes canonical relational data; it does not retroactively override immutable reports.
- The pre-existing booking/subscription steps in #155 describe end-to-end product requirements, **not** work currently authorized for the Student/Teacher team. Their UI read-only/hand-off contracts remain in scope, actual operational administration is deferred.

## Risks and dependencies

- Staff invitation issuer, legal/guardian verification, private document retention and professional credential validation require a dedicated later issue/PR and privacy acceptance.
- Classroom event contract/real end events remain a separate delivery gate; a green source build is not proof that lessons can be completed.
- Architecture remains Cloudflare-only per ADR 0004. This ADR changes delivery ownership and sequencing, not security requirements.

## 2026-11-01 narrow owner amendment — start secure read-only shell in parallel (#302)
The owner confirmed starting the Admin Dashboard foundation while remaining Student/Sheikh paths close. This **does not supersede** the original decision that complete operational administration and all privileged actions/finance/invitations are last. A temporary, **default-disabled** Arabic RTL staff landing, verified signed D1 authorization and aggregate counts may be authored and tested on a development branch. No real student details, admin mutation controls, teacher onboarding application, price, payout or payment provider is implied. Activate UI/Worker flags only after a separate independent source review and signed Cloudflare Dev two-role proof. All prior consent, privacy, role and production gates remain binding.
