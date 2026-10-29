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
