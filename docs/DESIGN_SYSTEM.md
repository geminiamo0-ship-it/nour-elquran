# Noor Al-Quran — Approved Frontend Design System (V1)

**Decision date:** 2026-10-28  
**Reference:** owner-approved landing design **V2**, amended to **V3** (smooth section navigation + guardian mobile number).
**Tracking:** [Design Issue #9](https://github.com/geminiamo0-ship-it/nour-elquran/issues/9), product roadmap [#3](https://github.com/geminiamo0-ship-it/nour-elquran/issues/3).

> This is an **approved design specification**, not evidence a Next.js app exists. The interactive HTML proof-of-concept was reviewed externally and remains a mock; future product code requires a separate issue/PR/test cycle.

## 1. Identity and personality

- Arabic `lang="ar" dir="rtl"` first, mobile-first, calm and credible Quran-school visual identity inspired by restrained traditional Azhar aesthetics.
- Formal, welcoming language for families, learners of all ages, men and women, including minors. Avoid generic AI gradients, bright neon, emoji-heavy decorative marketing and unnecessary busy effects.
- **Full text logotype**: «نور القرآن», with subordinate line «للحفظ والإتقان». No truncated wordmarks.
- **Icon**: original **crescent + open Quran book**. No six-pointed/Star-of-David motifs in logos, headers or recurring graphic branding.
- Decorative Islamic arch, book engraving, and sparing geometric patterns are acceptable; textual Quran content must be verified against canonical source.

## 2. Base CSS design tokens (match approved HTML)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F8F5EB` | page background (warm ivory) |
| `--paper-2` | `#FFFDF7` | cards/white canvas |
| `--paper-3` | `#F0EADC` | alternating sectional background |
| `--ink` | `#253C31` | primary body text |
| `--ink-2` | `#47544A` | secondary text |
| `--olive` | `#30493C` | primary deep green |
| `--olive-2` | `#21382E` | darkest green / display heading |
| `--gold` | `#AD8028` | gold CTA/accent |
| `--gold-dark` | `#8F6619` | hover/focus-accent text |
| `--gold-soft` | `#DECA97` | muted gold highlight |
| `--border` | `#E4D9C0` | warm card/input separators |
| `--container` | `1170px` | content width cap |

Use tokens not arbitrary new palettes. Check practical text/background contrast and color-blind independence; do not assume any gold-on-ivory pair passes AA merely because it appears in the mock.

## 3. Typography

- Display, important headings, branded text, Quran-centric ornamental headings: **Amiri**, fallback **Noto Naskh Arabic**, then serif.
- Body copy, buttons, forms, metadata, navigation and Dashboard UI: **Tajawal**, fallback **Noto Kufi Arabic**, then Tahoma/sans.
- Responsive hierarchy: landing H1 approx `clamp(48px, 5vw, 78px)`; H2 approx `clamp(35px, 4vw, 52px)`; body default 16px with generous Arabic line-height (~1.75). Mobile sizes reduce proportionally.
- Do not use ornamental fonts in compact metric dashboards or data-entry controls; use semantic heading levels.

## 4. Components, visual grammar, interaction

- Gold filled main CTA with ivory/white text; green/outlined secondary CTA; understated borders, minimal corner radius (typically 3–9px), restrained raised-edge/shadow on highlighted cards; avoid giant glassmorphism shadows.
- Content cards: warm ivory background, 1px warm border, generous breathing room; some have 3–4px gold top accent.
- Layout: centered `min(1170px, viewport width - gutters)`, balanced responsive grid, one column on mobile. All content in correct RTL flow.
- Header sticky with original crescent/book icon, full wordmark + subtitle, desktop nav, accessible mobile menu.
- All `#fragment` CTA/nav actions must produce **smooth section scrolling**, with correct sticky-header offset. Header and hero «احجز حصة تجريبية» must scroll to **registration `#enroll`**, not a booking-before-registration page. «تعرّف على البرامج» scrolls to `#programs`. Keep browser hash and support `prefers-reduced-motion: reduce`. A brief subtle gold focus/pulse may draw attention to registration.
- Accessibility: keyboard activation and visible focus, explicit labels, required markers, keyboard-operable FAQ accordions and menu, mobile touch targets, avoid horizontal overflow. Never use color as sole state.
- Validate source rendering on 390px mobile and 1440px desktop; test at smaller screens where possible.

## 5. Approved landing ordering/content

1. **Header/Hero** — main original headline «مع القرآن يزهر القلب ويستقيم اللسان», reserve «احجز حصة تجريبية» and «تعرّف على البرامج» CTAs, branded arch/illustrated open mushaf.
2. **Three benefits** — clear progression, teacher recitation, suitable lesson timings.
3. **Programs** — «لكل مرحلة طريق إلى الإتقان», cards «تصحيح التلاوة», «حفظ القرآن الكريم», «المراجعة والتثبيت». Remove "inquire about program" links.
4. **Interactive mushaf classroom showcase** — directly after programs, heading «المصحف أمامكم والحفظ هدفكم», two-way teacher/student pen/highlight/typed notes and sample lesson archiving; actual transport is separate LiveKit Cloud proposal per Issue #7.
5. **Quran verse + audience** — preserve the approved original verse `﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ ﴾`; describe offerings for children/guardians and adult learners of both sexes.
6. **Three onboarding steps** — register → immediately access Student Dashboard → book trial from inside Dashboard. Three numbered cards; remove fake weekly schedule.
7. **Simplified account registration** — «ابدأ رحلتك القرآنية». Required account owner name; **required guardian mobile** for child enrollment (self-enrolling adults label it mobile); learner name/profile; rough level; optional email in standalone HTML demo; add another child to same account. Validate phone and clearly disclose demo does not send messages or create accounts.
8. **FAQ** — final section before Footer.
9. **Footer** — same logo and restrained palette.

Remove entirely: "مرحبًا بعودتك أحمد ومريم وسيف" family dashboard preview section, "لكل واحد من أبنائك رحلة" showcase, weekly lesson schedule promo, "التجربة قبل القرار", "التصور المبدئي", redundant "بيتك الثاني مع القرآن يبدأ بحسابك" CTA/pitch sections.

## 6. Approved registration/product funnel

Visitor can click «احجز حصة تجريبية», **scrolls to signup**, registers adult account and one or more independently tracked student profiles → **immediately enters full Student Dashboard** → later books a real trial slot from within Dashboard → teacher assessment → potential paid program.

- No dedicated parent dashboard. Account holder can switch learner profiles from shared header as needed.
- Demo signup is client-only UI; real verification, OTP, duplicate handling, data retention, privacy/legal and teacher slot transactions are not implemented.
- Parents' phone numbers and minors' details are sensitive: do not write personal phone numbers or student names to logs, analytics, public URLs, or client-only static files. Real auth must be verified server-side.

## 7. Cross-page application

This is the reference design system for future **Student**, **Teacher**, **Admin** and **Classroom** surfaces. Keep shared layout/brand tokens, typography, visual language, icons and focus behavior consistent.

Do **not** simply duplicate landing marketing card density in a productivity dashboard: use compact, accessible UI composition based on these same tokens.

## 8. Scope / verification

- Approved: visual identity and landing section order, CTA behavior and required guardian contact, registration-first dashboard access.
- Not approved/completed: a deployed site, production signup/booking, backend/LiveKit integration, other pages' precise UX, payment plan, privacy consent rules, Quran licensing.
- Per-page feature issues must provide actual Playwright checks for RTL/mobile, navigation, form errors, account state, keyboard, focus and contrast.

**Next action:** use Issue #3 to agree Student Dashboard page structure, then write a scoped implementation issue; do not start writing the app merely because the design has been approved.
