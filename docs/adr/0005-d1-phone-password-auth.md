# ADR 0005: Maintained Workers/D1 account authentication

Date: 2026-10-29  
Status: implementation choice under AUTH-01 #110 / #46; real-user rollout pending

## Context and decision
The owner approved Cloudflare-only hosted infrastructure. The existing funnel requires a mobile number and makes email optional. Use pinned Better Auth 1.7.14 with its first-party Drizzle adapter and D1 rather than implement password hashing/session signing in application code. SQLite adapter transactions are explicitly disabled for D1. Native local acceptance executes the actual library and migration; it does not substitute for cloud staging.

Phone/password is the initial integration default. No phone delivery provider is configured, so registration stores `phoneNumberVerified=false`; OTP, password recovery and phone changes are not exposed. Random `.invalid` email identifiers satisfy the maintained library's core credential schema without collecting or inventing a customer contact address. Delivery-backed ownership verification and protection against phone pre-registration abuse are prerequisites for real-user rollout, tracked in #46. No paid or staff action is authorized by this slice.

## Boundary and alternatives
A small public API allowlist delegates registration/login/logout to Better Auth. The raw library handler is never mounted publicly. Protected requests use the library's signed session verification and D1 lookup with cookie cache disabled, then query an active domain account from that verified subject. Core `accounts` and library credential-account records remain separate tables.

Same-origin production cookies use Secure, HttpOnly and SameSite=Lax. Exact trusted Origin is required for mutations. Credential rate limits persist in D1; only Cloudflare's trusted client-IP header is considered, with the library's shared fallback when absent. Email/password login would conflict with optional email; SMS-only login would depend on delivery and recurring messages. These remain possible future changes requiring verified flows.

## Consequences, verification and rollback
The owner session can manage its profiles; restricted child sessions, staff roles and adult authorization need explicit follow-up. API DTOs never expose session tokens, hashes or internal email IDs. No custom password crypto, forged header identity, arbitrary user update or publicly reachable reset endpoint is accepted.

Run all Verify jobs including native local signup/login, origin/body limits, cross-account read denial, database-backed rate limiting, logout/replay, account disable and expiry. Cloud deployment, phone delivery/recovery and frontend UX require separate evidence. Disable AUTH_ENABLED to roll back exposure while retaining additive schema/data; do not drop live credential tables.

## Primary references
- [Better Auth Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Phone number plugin](https://www.better-auth.com/docs/plugins/phone-number)
- [Session management](https://www.better-auth.com/docs/concepts/session-management)
- [Pinned 1.7.14 source](https://github.com/better-auth/better-auth/tree/v1.7.14)
