# Security, child safety and privacy baseline

- Target children and adults; child profile belongs to verified adult account where relevant. No exposed full names/voice recordings in test fixtures or public Git history.
- Single account may manage siblings, but each profile's lessons, AI tasks, reports and teachers are separately authorized. A client-supplied student_id never grants permission.
- Auth Supabase JWT must be verified server-side; no service-role or model/API keys in the browser.
- Teacher access limited to assigned learners; admin roles have audited least-privilege access.
- Billing and account management require adult authorization; consider PIN or re-authentication and rate limiting.
- Audio recording OFF by default. Informed permission, access controls, retention period and deletion flows are required before live recording/upload features.
- Quran media licenses / recitation rights must be verified for commercial product use before shipping.
- AI output cannot create or alter canonical Quran text and cannot autonomously certify tajweed/competence.
- Logs and analytics use pseudonymous identifiers; no unnecessarily collected child data.
- CSP, CSRF, secure cookies, origin restrictions, webhook signature verification, secret rotation and data export/deletion should each have implementation Issues before launch.
- Public GitHub repository: commit **zero** real customer/student data, API keys, environment files or private media.
- Treat architecture, cost figures, hosting selections and compliance as proposals until tested and approved.
