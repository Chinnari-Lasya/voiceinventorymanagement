# UX_SPEC

Designed for a shopkeeper with one hand busy, a mid-range Android phone, mixed-language speech, and low tolerance for typing or jargon. Target viewport **360×800**; scales up.

## 1. Experience principles

1. **Glanceable:** in 3 seconds the owner sees *what needs attention*, not a table of everything.
2. **Speak first, type never (unless the mic fails).** Every common task is one mic tap + at most one confirm tap.
3. **Show what I understood.** Nothing changes until the user has seen the interpretation in plain words.
4. **Cheap correction.** Any mistake is fixed by tapping a chip and choosing — not by retyping.
5. **Plain words, user's language.** No "SKU", "transaction", "reconcile". Use "stock", "entry", "came", "sold".
6. **Calm confidence.** Warm, high-contrast, generous spacing; amber/red used only for real attention.
7. **Never dead-end.** Every failure state shows what to do next (typed input, retry, examples).

## 2. Information architecture

```
Login (username + PIN)
└─ Home (Dashboard)  ← 90 % of use
    ├─ Voice sheet (bottom sheet over Home): listening → interpreting → Card | Question | Answer
    ├─ Product detail (push): stock, +/- adjust, history, units, alias, threshold
    ├─ Reorder list (push): explained suggestions   [P1: WhatsApp share]
    └─ Activity (push): full history with Undo
Settings (P1): language, lead time, demo mode toggle
```

## 3. Design tokens

- **Font:** Inter/system stack for Latin; **Noto Sans Telugu** and **Noto Sans Devanagari** via `next/font` (falls back to system fonts if unavailable). Base 16 px, quantity numerals 28–32 px semi-bold, tabular figures.
- **Colour (light theme first; dark P2):** background warm off-white `#FAF7F2`; surface `#FFFFFF`; ink `#1F2933`; primary (mic, confirm) deep teal `#0F766E`; attention amber `#B45309` on `#FEF3C7`; danger red `#B91C1C` on `#FEE2E2`; ok green `#166534` on `#DCFCE7`. All text/background pairs ≥ WCAG AA (4.5:1). Status is **never colour-only** — always icon + word.
- **Shape/spacing:** 16 px page gutters, 12 px radius cards, 8-pt spacing scale, minimum touch target 48×48 px, mic button 72 px.
- **Motion:** 150–200 ms transitions; listening waveform pulse; number roll on stock change (respect `prefers-reduced-motion`).

## 4. Screens

### 4.1 Home / Dashboard (primary)

```
┌──────────────────────────────┐
│ Lakshmi Kirana Store   [తె▾] │  shop name · language chip (en|हि|తె)
│ ⚠ Basic mode (if degraded)   │  banner only when relevant
├──────────────────────────────┤
│ NEEDS ATTENTION          (3) │
│ ┌──────────────────────────┐ │  horizontal cards / stacked list
│ │ ▲ Toor Dal      9 kg     │ │  status icon + word: "Low — ~2 days left"
│ │   Low · ~2 days left     │ │  tap → product detail; "Why?" link → explanation
│ └──────────────────────────┘ │
│  [ See reorder list → ]      │
├──────────────────────────────┤
│ 🔍 Search stock              │
│ Rice            23 bags   OK │  stock rows: name · big qty+unit · status pill · tiny 14-day sparkline
│ Sugar           50 kg  ⚠ Low │
│ Eggs            8 dozen   OK │
│ …                            │
├──────────────────────────────┤
│ RECENT                       │
│ + 5 bags Rice · 2 min · Undo │
│ − 10 kg Sugar · 1 h          │
│              [ See all → ]   │
├──────────────────────────────┤
│   ⌨        ( 🎤 )       ?    │  persistent dock: type · MIC (72px) · help/examples
│        Tap and speak         │
└──────────────────────────────┘
```

Rules: attention strip shows top 3 by urgency (OUT > LOW by days-left); empty state "All stocked up 👍"; list sorted by attention then name; sparkline is inline SVG from real transaction data; pull-to-refresh (SWR revalidate). Recent activity has inline **Undo** on the latest 10.

### 4.2 Voice sheet (bottom sheet, ~70 % height)

States and content:

| State | Visual | Text |
|---|---|---|
| **Listening** | pulsing mic + waveform bars | live interim transcript in large text; hint "Say e.g. *Rice 5 bags vachindi*" (language-aware examples) |
| **Interpreting** | skeleton card, subtle spinner | "Understanding…" (transcript stays visible) |
| **Card (T1)** | Interpretation Card (below) | primary **Confirm**, secondary **Cancel**, tertiary **Speak again** |
| **Card (T2)** | same, amber flagged rows | primary reads the change: "Set Rice to 0"; note "Please check the highlighted part" |
| **Question (T3)** | Question card with option chips | no confirm button; chips + "Say or type answer" |
| **Answer (T0)** | answer card (facts + optional "Why?") | localised sentence + mini table; actions: "Open reorder list" |
| **Done** | green check + rolled number | "Done. Rice stock is now 23 bags." + **Undo** (10 s prominent) → auto-dismiss 4 s |
| **Error** | red inline banner | plain reason + "Type instead" / "Try again" |

### 4.3 Interpretation Card (core trust component)

```
┌──────────────────────────────────────┐
│ You said:  “Rice five bags vachindi” │  transcript, with recognised parts highlighted
│ ─────────────────────────────────── │
│  + ADD                               │  op chip (tap to switch add/remove/set)
│  [ Rice ▾ ]   [ 5 ▾ ]  [ bags ▾ ]    │  three tappable chips: product · quantity · unit
│  Stock: 18 bags → 23 bags            │  before → after preview (from DB)
│  (5 bags = 125 kg)                   │  normalised amount, shown only when unit ≠ base
│ ─────────────────────────────────── │
│  ⚠ Heard “15” too — which?  [5][15]│  T2 issue row (only when flagged)
│ [ ✕ Cancel ]        [ ✓ Confirm ]    │
└──────────────────────────────────────┘
```

- Chips open a compact picker: product picker = search + top candidates (typing allowed but minimal); quantity = number stepper + speech "say a number"; unit = list of units valid for that product (universal + configured packs).
- Any chip change sends a **patch** to `/api/voice/:id/*`; the card re-renders from the re-validated plan (never edited locally).
- Multi-item: one card per item stacked, each with ✕ to drop, single **Confirm all (3)**.
- Localised plain-language line above buttons: EN "Add 5 bags of Rice?" / TE "Rice 5 బస్తాలు యాడ్ చేయాలా?" / HI "Rice 5 बोरी जोड़ें?" (native review needed).

### 4.4 Question card (clarification)

"Which one? · [Toor Dal] [Moong Dal] · Something else…" · "1 bag of Sugar = how many kg?" → numeric chips (25 · 50 · other) + mic/keypad. Options are large tap targets; the sheet stays in listening-ready mode so the answer can be spoken.

### 4.5 Product detail

Header: name, big stock, status pill, "Why?" (alert reasoning). Sections: **Adjust** (− / + steppers in display unit, "Set exact count" — routes through InventoryService as `manual`), **History** (last 20 entries with Undo on latest), **Units** ("1 bag = 25 kg", "+ Add pack size"), **Names I understand** (aliases; learned ones tagged), **Alert level** (optional threshold). Nothing here requires typing except numbers/optional names.

### 4.6 Reorder list

Rows: product · suggested qty (packs and base) · one-line reason ("~4 kg/day, ~2 days left"). Tap row → expanded math (inputs from the insight engine). P1: "Share on WhatsApp" builds `https://wa.me/?text=…` with the list.

### 4.7 Activity

Reverse-chronological ledger (icon +/−, product, spoken quantity, normalised, who/how: 🎤 / ✋ / ↩), Undo on eligible rows, grouped by day.

### 4.8 Login

Username + 4–6 digit PIN keypad (large numeric pad), "Demo login" button when `DEMO_MODE=1`. Errors: "Wrong PIN. Try again." (lockout message on rate limit).

## 5. Language & localisation

- Language chip (en/hi/te) sets STT locale hint and reply language preference; the *pipeline* still detects language per utterance and replies in the dominant one.
- P0: English UI chrome + localised replies/cards/questions (templates). P1: full chrome localisation via a tiny dictionary (`t('key')`), ~80 keys.
- Product names shown as stored (often English/Latin) — matches how shopkeepers speak; aliases in native scripts appear in "Names I understand".
- Native-speaker review of all Telugu/Hindi strings is a **tracked human task**.

## 6. States & edge cases (must be designed, not left to default)

Empty shop · no attention items · long product names (truncate + full in detail) · mic denied · unsupported browser · no-speech timeout · noisy/short transcript · LLM down (Basic mode banner) · network error (retry chip) · session expired (soft redirect) · double-tap Confirm (idempotent) · undo not possible ("Can't undo — it would make stock negative") · very large quantity (T2) · keyboard open on small screens (sheet scrolls, buttons remain reachable).

## 7. Accessibility

Contrast AA; focus states; buttons ≥ 48 px; all icons have text or `aria-label`; sheet traps focus and is dismissible; live regions announce results (`aria-live="polite"`); respects reduced motion; text scales to 200 % without horizontal scroll.

## 8. Demo mode (`DEMO_MODE=1` or `?demo=1`)

Adds a "Try saying…" row of phrase chips in the Voice sheet (e.g., "Rice five bags vachindi", "Dal 5 kilo aaye", "Sugar 2 bags vachindi", "Kya order karna hai"). Tapping a chip **submits its text through the real pipeline** — same LLM/fallback, same validation. It exists for rehearsal and mic failure, and is labelled "typed" in history. No canned results.

## 9. Micro-copy rules

Short, second-person, no jargon; confirmations end with a question; results state the *new stock*; errors say what happened and what to do; never blame the user's speech ("I couldn't catch that — tap to try again or type").
