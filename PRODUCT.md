# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

An installable, offline-first PWA. Mobile web (phone held in one hand) is a first-class context, not a fallback.

## Users

Primarily the maker: Qoddy is a personal tool first. Other readers are welcome (the site has been public at https://qoddy.mswsi.net since 2026-11-16) but they do not drive decisions. Readers speak English or Russian. The job is a small daily ritual: open the app, read one thought, maybe unfold its notes, keep it, or write a thought of one's own.

## Product Purpose

A thought for each day, set quietly on the page, and a place to keep your own. Success is a reader who comes back daily because the page is calm and worth sitting with, and who trusts the app with their own thoughts.

## Positioning

Quiet and private. One thought, set like a page in a book: no feed, no ads, no tracking, no engagement mechanics. A reader's own thoughts stay theirs: the app works offline and without an account, sync is optional, thoughts can be encrypted in the browser with the account password, locked behind an app passcode, and exported as Markdown at any time. Every reader sees the same public thought on the same day.

## Operating Context

- Opened once a day, often on a phone, sometimes installed as an app; must work with no network.
- Reading app (`src/routes/(app)`) is client-rendered and reads only from the device's library; the server exists to sync.
- Navigation through days by arrows, arrow keys and swipes; menu holds collections, themes, language, account pages.
- Admins curate public collections in a server-rendered dashboard (`/admin`) and the CLI.

## Capabilities and Constraints

- Thoughts: text plus optional author, source, Markdown notes, `lang` (direction, quotes, CJK sizing), and per-thought theme, color and Google Font.
- Collections: public (admin-curated, hideable), "Your thoughts", and reader-made collections; home page from a chosen collection.
- Reading options on this device: keep my theme, focus mode, double-click for another thought; share a thought as a 1080×1350 image.
- Look is three independent reader choices: light/dark/system, accent color, theme (Neutral, Book, Salon, Confetti), plus a pastel paper tone. Theme ids never change.
- A thought too long for the window is set smaller (down to 55%) rather than scroll.
- Live users exist: changes must keep old devices' stored data and old cached clients working (see CLAUDE.md).
- The admin dashboard stays plain and utilitarian, server-rendered with no JavaScript. Design effort goes to the reading app.

## Brand Commitments

- Name: Qoddy. Site name is an admin setting (`site_name`).
- Voice: plain, calm, exact. Short sentences, no hype, no exclamation, no gamification ("streaks", badges). Says what happens to the reader's data in concrete terms.
- English and Russian are equal: every reader-facing string and layout must work in both, including longer Russian words.

## Evidence on Hand

- Public collections are curated by admins from real sources (fixtures in `fixtures/thoughts.csv`, `fixtures/stoics.csv`). Never generate or invent quotes, attributions or notes.
- Icons in `static/` (`icon.svg`, PNG sizes, maskable, splash).
- No testimonials, user counts or press exist; do not fabricate them.

## Product Principles

1. The thought comes first. Everything else recedes until asked for.
2. The reader's thoughts belong to the reader: nothing leaves a device or gets lost without their asking.
3. Calm over engagement: no feeds, counters, nudges or streaks.
4. Works anywhere: offline, signed out, on a phone, in either language.
5. Built for the maker's own daily use; generality only where it costs nothing.

## Accessibility & Inclusion

- WCAG 2.2 AA is the floor across the reading app, in every theme, light and dark, and with reader-chosen accents and paper tones.
- Right-to-left and CJK text in thoughts must lay out correctly.
- Keyboard and swipe navigation both work; reduced-motion preferences are respected.
