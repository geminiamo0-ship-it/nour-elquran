# Security, child safety and privacy baseline

## AUTH-01 #110 implementation boundary
Better Auth handles password hashing and signed session cookies. Cookie caching is disabled; each protected request revalidates its session in D1, then loads the active owner account. Only session-derived account IDs reach learner SQL. Owner sessions intentionally access all their learner profiles; no restricted-child login or teacher/staff route is introduced.
Public wrappers accept a bounded JSON allowlist, enforce exact trusted Origin for mutations, use non-cacheable sanitized responses and library database-backed credential rate limiting. Production cookies are Secure, HttpOnly and SameSite=Lax. HTTP cookies require explicit localhost development configuration. The internal library API is not publicly routed, so optional email, verification, password reset and user-update endpoints are not exposed.
Phone/password is the initial integration default; phone ownership and adult/guardian identity remain unverified. Generated internal `.invalid` email identifiers are never presented as customer contact addresses. Delivery-backed verification/recovery, protection against phone pre-registration abuse and adult authorization must be completed before real-user rollout. No real student records or messages are used by tests.

Platform approved in [ADR 0004](adr/0004-cloudflare-only-platform.md): D1 + Workers application authorization replaces Supabase Auth/Postgres/RLS. Family owner access vs restricted child sessions must be represented honestly. Current API foundation denies all learner endpoints until actual auth integration.


- Target children and adults; child profile belongs to verified adult account where relevant. No exposed full names/voice recordings in test fixtures or public Git history.
- Single account may manage siblings, but each profile's lessons, AI tasks, reports and teachers are separately authorized. A client-supplied student_id never grants permission.
- Authenticate sessions server-side with the maintained Workers-hosted auth library (#46); then authorize account/learner/resource/time at every use case. No Cloudflare admin token, D1 binding, auth secret or model/API key in the browser.
- Teacher access limited to assigned learners; admin roles have audited least-privilege access.
- Billing and account management require adult authorization; consider PIN or re-authentication and rate limiting.
- Audio recording OFF by default. Informed permission, access controls, retention period and deletion flows are required before live recording/upload features.
- Quran media licenses / recitation rights must be verified for commercial product use before shipping.
- AI output cannot create or alter canonical Quran text and cannot autonomously certify tajweed/competence.
- Logs and analytics use pseudonymous identifiers; no unnecessarily collected child data.
- CSP, CSRF, secure cookies, origin restrictions, webhook signature verification, secret rotation and data export/deletion should each have implementation Issues before launch.
- Public GitHub repository: commit **zero** real customer/student data, API keys, environment files or private media.
- Treat architecture, cost figures, hosting selections and compliance as proposals until tested and approved.

