# Quran source deployment

Edition: Hafs KFGQPC, 604 pages. Page SVG and ayah metadata from Quran.ws version v1.1.1. Text from Uthmani chapter JSON by risan/quran-json. Licenses and upstream rights documented at https://quran.ws/docs/reference/licensing/ and https://github.com/risan/quran-json.

Bucket: noor-quran-hafs-v1 (isolated from Santo). Worker: noor-quran-assets (read-only Quran files). Infrastructure code in Santoreno PR #216. Do not assert successful provisioning until its workflow completes. No learner data belongs in this bucket.

Verify: 604 SVG + 604 metadata pages, 114 chapter JSON, manifest committed last, first/last SVG visual checks, no unrelated Worker routes, Noor CI lint/TS/unit/build/browser and actual hosting. Never synthesize Quran text.

## Quran text integrity and required attribution (S04 follow-up, 2026-10-28)
- The `risan/quran-json` Uthmani chapter files use numeric `id` for both chapter and verses (`{ id: 1, verses: [{ id: 1, text: ... }] }`). Never infer a missing verse number from array position, silently shift verse references, or change text/diacritics.
- The Uthmani text is sourced from **Tanzil Project**, licensed CC BY 3.0 with a no-alteration requirement, explicit source credit and a link to [tanzil.net](https://tanzil.net/). Keep the upstream notice when redistributing files and the visible attribution in the reader. See [Quran JSON](https://quran-json.risanb.com/text/uthmani/chapters/1.json).
- Quran.ws metadata/polygons have CC BY 4.0 terms; the KFGQPC SVG artwork has separate publisher terms. Check the upstream [licensing reference](https://quran.ws/docs/reference/quran-svg/) before commercial publication. UI attribution does not replace a full license review.
- Verified by source inspection, **not** by a live R2 bucket audit. Keep source/canonical crosswalk, image and metadata integrity, and production license sign-off open under #79.
