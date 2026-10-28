# Quran source deployment

Edition: Hafs KFGQPC, 604 pages. Page SVG and ayah metadata from Quran.ws version v1.1.1. Text from Uthmani chapter JSON by risan/quran-json. Licenses and upstream rights documented at https://quran.ws/docs/reference/licensing/ and https://github.com/risan/quran-json.

Bucket: noor-quran-hafs-v1 (isolated from Santo). Worker: noor-quran-assets (read-only Quran files). Infrastructure code in Santoreno PR #216. Do not assert successful provisioning until its workflow completes. No learner data belongs in this bucket.

Verify: 604 SVG + 604 metadata pages, 114 chapter JSON, manifest committed last, first/last SVG visual checks, no unrelated Worker routes, Noor CI lint/TS/unit/build/browser and actual hosting. Never synthesize Quran text.
