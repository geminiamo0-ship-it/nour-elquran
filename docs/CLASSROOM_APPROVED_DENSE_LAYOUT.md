# APPROVED — Noor Quran classroom dense layout (2026-10-29)

**Decision:** Owner explicitly approved the two final design mockups from the live discussion ("ممتاز نعتمد"). This is the authoritative visual direction for the **teacher desktop lesson** and **student phone lesson**. Related #7, #45, #50, #120. Approval is of layout and interaction intent, **not** permission to copy generated Quran calligraphy, invented participation counts or fictional live/media states.

## Teacher desktop — agreed layout

- Full viewport **no outer document scrolling**; dedicated `وضع الحصة` activates full-screen/focus presentation and has an equally visible Exit. Only long *inner* corrections/history pane may scroll; all essential controls remain usable without scrolling.
- Minimal integrated top chrome: Noor identity/exit, actual classroom status + participant presence + clock, **single narrow horizontal drawing/navigation toolbar**. No duplicative large explanatory cards or 3–4 big banners eating the Quran's height. Mock-role/presence/clock testing controls stay explicitly labeled as *preview* and must not resemble real authentication.
- Three columns with **large central Quran**, teacher's lesson notes/error categories/three independent grades on one compact side, and participant camera tiles on the opposite side. Camera tiles expand to use their allotted panel space rather than leaving unusable blank white areas. Sheikh own preview may be hidden locally without disabling outgoing camera.
- Use the **existing canonical 604-page mushaf**. Original page ratio and verse/word hit-testing must not be stretched/changed to imitate AI-generated typography. Use whitespace to the sides of the page for teacher-only previous/next page controls rather than placing meaningless decoration.
- Ink palette and controls remain small yet pointer/stylus accessible: Quran text selection, pen, marker, eraser, color dots and page navigation; the Sheikh's pupil mute/pause commands remain accessible. The Sheikh exclusively controls page navigation; both members may draw shared marks by default, Sheikh may pause student drawing and hide only shared marks with audit. No remote mic unmute.
- Per-ayah corrections and three nullable 0..10 grades; editing/publishing reports remains a separate deliberate workflow. Do not turn visual save labels in illustrative images into a fabricated server persistence claim.

## Student mobile — agreed layout

- The **Sheikh video is the first primary content region**, then the **largest available synchronized Quran**, with minimal insets around the Quran. This ordering remains the priority when real LiveKit video and DO Quran sync are connected.
- Very slim header/status, compact student-appropriate icons, no Sheikh-only editing/report panels in the student's layout. Student cannot Start or End the lesson nor change shared Quran page.
- Phone accessibility: fit 360 and 390 CSS px and dynamic height, including Samsung mobile browser address bars/safe areas and enlarged fonts. Keep camera and Quran visible without outer scroll in regular portrait; permit controlled internal access/zoom in accessibility modes instead of clipping Quran text.
- The mock only has **two participants**, not the fictional twelve-person count present in an AI design image. Camera tile must not claim active LiveKit before it exists.

## Current implementation and verification requirements

- UI implementation branch `feat/classroom-approved-dense-layout`: compact session row with collapsible demo clock, slimmer one-line tool strip, widened Quran workspace, teacher lateral page arrows with correct 1..604 bounds, responsive mobile priority, teaching panel filling usable height and notes inline with grading draft. All text-based interaction remains real React components.
- Run exact-head TypeScript/lint/Vitest/Chrome responsive checks including 360, 390, 768, 1440 CSS px, 100dvh no outer scroll, Quran within frame, video before Quran on student phone, correct page navigation, focus toggle and teacher-only authority.
- This is **not** a LiveKit room or synchronized Quran. Use real verified Worker/DO presence and LiveKit Cloud A/V as authorized per ADR 0007 before claiming a production class. The reference imagery may have inaccurate Quran characters or imaginary icons; **canonical Quran data always wins**.

## Implementation acceptance criterion

The changes are accepted when the staging browser visibly matches the approved *density and hierarchy* on teacher desktop and student mobile, with all core actions accessible and all existing semantic/security tests green. They do not need to reproduce nonsensical buttons or artificial participant/video state from a concept rendering.


## Actual screenshot regression and corrected sizing (2026-10-29)

The owner supplied **real current staging screenshots** after the previously green #132 rollout and reported **no material change**: student phone displayed a tiny Quran despite large unused space, and teacher desktop still showed blank panel gaps. The old browser test checked sheet containment only and completely missed the content being too small. Repeated CSS additions in `Classroom.module.css` accumulated contradictory height/width overrides; the generic canonical Quran page also enforced a `calc((100dvh - 140px) * 345 / 550)` mobile width rule, and classroom page added a second aspect+height restriction.

Corrective architecture in `fix/classroom-real-viewport-layout`:
- Replaced the entire additive 30KB classroom CSS cascade with one viewport grid/flex design, using narrow header/status/toolbars and a real flex remainder for the Quran.
- Added optional `viewportFit` to the canonical `ReaderPrintedPage` → `SmoothMadinahPage`; the classroom alone sizes the verified Quran image using **container query height `100cqh`**, a 345:550 ratio and min of actual width/height. The student Quran component's generic mobile width subtraction no longer caps a classroom-sized page.
- When student view is selected, remove the empty third desktop column entirely. On phone give the Sheikh video a compact *fixed reserved* hero section, the Quran all remaining height, and move ancillary controls aside. No fake LiveKit connection or fabricated synced event handling.
- Remove the waiting-room banner over the Quran art; waiting is already explicit in the authenticated prejoin band. Keep teacher-only End and nav permissions and all other backend obligations intact.
- **Critical new acceptance:** Chrome at **360x667, 390x844, 1280x900, 1440x900** must report computed Quran bounding widths, video bounds and page aspect ratios. Minimum visible Quran widths: >=205px on short 360px student phone, >=245px on 390px student phone, >=395px on desktop; preserve 345:550 ratio, no outer scroll, student video before Quran. A passing test of containment alone is no longer acceptable.
- Both device screenshots uploaded as action artifacts. Inspect user-facing screenshots rather than claiming success from HTTP 200.
