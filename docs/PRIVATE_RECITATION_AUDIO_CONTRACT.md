## 2026-10-31 — future R2 byte verifier (#245, source-only)
- Added `verifyPrivateAudioBytes`: a bounded, pure pre-storage check of the **real binary payload**, parsed descriptor, exact byte size, container signatures (WebM EBML with WebM DocType; OggS version zero; MP4 `ftyp` with allowed brand), and SHA-256 using WebCrypto. No response includes raw audio, fingerprints other than a simple result code, or any signed URL. Tests use only synthetic byte arrays and reject edited bytes, malicious MIME mismatches, invalid sizes, malformed headers, and wrong digest.
- Container magic and an SHA-256 match **do not prove the file is valid/playable/benign audio, the stated duration is accurate, nor that it contains audio only**. A real decoder/ffprobe-like validation, anti-malware policy, private R2 lifecycle, authorization, guardian proof, consent and retention rules are still mandatory before any upload endpoint can be enabled.
- The function is **not called by a public route**; `PRIVATE_RECITATION_UPLOADS_ENABLED=false` and migration 0012 grant/upload denial triggers remain unchanged. This is defense-in-depth preparation, not working audio homework.

## Runtime defense-in-depth follow-up (#180, 2026-10-30)
- The key builder revalidates the complete descriptor and string learner UUID at runtime, rather than trusting a TypeScript annotation. The private playback-header helper rejects unsupported MIME values, including HTML, before creating any headers. This is only a guard against future caller mistakes, not proof of media sniffing or an enabled endpoint.
- Both the SQL grant/upload locks and `PRIVATE_RECITATION_UPLOADS_ENABLED=false` remain unchanged. No real media is accepted, stored or played; #180 policy and isolated R2 acceptance gates still apply.

# Private assignment recitation — source-only security contract (#182 / #180)

**Status 2026-10-30: SERVER UPLOAD, PLAYBACK, GUARDIAN CONSENT AND R2 ACTIVATION ALL OFF.** This is a guarded migration and typed backend preparation, **not** a working audio feature or approved personal-data handling policy. The existing `TrainingVoicePractice` browser recorder remains local-only and does not transmit recordings.

## Approved scope and isolation
- Each recording must eventually belong to exactly one `learner_id + assignment_id + submitted_attempt`, all checked from a verified Better Auth owner/teacher session **on each operation**. An active, qualified, assigned primary Sheikh can access only submitted records while authorized; revoked access must stop instantly. Owners may manage their own child profiles, subject to upcoming verified-guardian/age policy. No public object URLs, signed long-lived URLs, or direct browser R2 bindings.
- `workers/api/migrations/0012_recitation_audio_privacy.sql` adds immutable consent-decision and asset-metadata structures. Crucially, the database **rejects all grants and all asset reservations**, even from a server with D1 access, until an explicitly reviewed future migration replaces the two lock triggers. Revocation decisions are schema-supported for future flows but no public decision-write endpoint exists.
- `workers/api/src/private-recitation-audio.ts` validates UUIDv4 asset/submission IDs, 64-char lowercase SHA-256, allowed `audio/webm`, `audio/ogg`, `audio/mp4`, 1–8 MiB bytes, 1–240 seconds duration, constructs private opaque `assignment-audio/<learner-uuid>/<asset-uuid>.<ext>` keys and sets `private, no-store` playback headers. These limits are provisional technical guardrails, not an approved product policy or real media sniff/duration verification.
- `GET /v1/me/learners/:learnerId/recitation-audio-policy` is authorized per learner via existing session-owner checks and returns **disabled** only. POST to this route is 405; no user-visible recording/consent/upload/playback flow is added. If the migration is missing the read returns 503, never an enabled status.
- No R2 bucket binding, object writes, uploads, signed URL creation, playable audio, bytes or child-data logs are introduced.

## Remaining mandatory release gates (Phase 06, #180)
1. Approve the age/guardian verification procedure, consent disclosure + revocation semantics and exact version. Current phone/password `phoneVerified` does **not** establish guardian authority.
2. Approve retention length, withdrawal/deletion/export SLA and how deletions reconcile immutable audit and existing Sheikh reviews. Do not select silently.
3. Provision a **private**, isolated R2 bucket without public `r2.dev`; document request/byte quotas, malware/media validation, ownership and secret handling. Verify byte-level checksum and bounded content with actual R2 head/put/read/delete, cleanup of partial/orphaned objects and CAS/idempotency.
4. Design `reserve -> upload -> finalize -> review -> revoke/delete` transitions and auditable append-only lifecycle metadata. A request to upload must be bound to one consent version and one existing attempt. Every read, including Range, must recheck current ACL; no CDN or browser cache.
5. Native + real isolated Dev security matrix: owner A/B, siblings, disabled child/guardian, owner and teacher revocations, foreign asset and forged keys, size, duration, MIME sniff, hash mismatch, concurrency, replay, expiry, delete/export, network failure, R2 errors. Browser visual review belongs to the owner, not default CI.
6. Only after 1–5 and explicit product/privacy approval, build opt-in UI for *Send recitation to Sheikh*. Never start microphone automatically, never auto-submit, never assign AI tajweed scores.

**Rollback:** source change/Worker code may be reverted; D1 0012 is additive and must not be dropped after migration. Keep lock triggers until a separate, tested security migration authorizes recording. No user recordings exist under #182.
