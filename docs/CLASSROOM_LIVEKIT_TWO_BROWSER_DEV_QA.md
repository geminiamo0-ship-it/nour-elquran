# Noor CR-02B3 — two-browser synthetic LiveKit staging acceptance

**Scope:** genuine LiveKit Cloud WebRTC connection and track transport using two
distinct synthetic signed Better Auth accounts within an actual staging D1
lesson, not a real minor or production. The public classroom visual preview
remains separate from this signed two-party media gate.

The dedicated Santoreno CI runner obtains only ephemeral browser session cookies
from Noor staging QA account registration during an eligible lesson. Teacher
qualification/assignment and all synthetic privileges are cleaned up after
success or failure. No account credentials, JWTs, room names, or cookies may
be logged or included in screenshots/artifacts.

The trusted Noor `scripts/chrome-local.mjs` enables fake device flags only
on the exact `noor-site-staging.*.workers.dev` origin when
`NOOR_SYNTHETIC_LIVEKIT_QA=true` and the caller explicitly requests
`syntheticMedia:true`. Other Chrome previews do not use fake media flags.
No real hardware is captured by GitHub CI.

Only the separately opted-in Santoreno staging workflow runs actual LiveKit
WebRTC, explicitly clicks media connection and the local camera/mic controls,
checks that publishing stays off by default, validates remote synthetic audio
and video tracks on both sides, then captures responsive synthetic screenshots.
Any provider failure stays a release blocker; don't replace remote media with
mock HTML to pass QA. Screenshots never include child content or credentials.

**Acceptance is not complete until:** both browser sessions report genuine
LiveKit connected state, bidirectional synthetic A/V arrives, disconnect and
reconnect work, 360/390/1280 viewports have no horizontal overflow, provider
participant revocation is verified, and the owner separately tests video/audio
on their own consenting devices. No Production, no recording, no real minors.
See tracked #219 and release blocker #206.
