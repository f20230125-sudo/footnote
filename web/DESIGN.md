# DESIGN.md: Footnote

Status: Built and live. Direction picked by Claude under Uzair's blanket go-ahead of 2026-10-13; not yet reviewed by him.
Pages covered: `/` (search, with and without a search in the address), `/results`, `/how`, the not-found page, header, footer, icon and `og:image`.
Written 2026-10-13 by the design director. Pictures cited are in the session scratch folder
`C:\Users\UZAIR\AppData\Local\Temp\claude\d--claude-workspace\dc3256bc-48b3-4c89-b760-cb9e543aa661\scratchpad\footnote\`
(`fn-search-*.png` are the live site with a search in the address, scanned today; `mock-light.png` and `mock-dark.png` are static sketches of the first screen, not a build; `sans.png`, `mono.png`, `zoom.png` are the type specimens; `contrast.mjs` is the arithmetic).
Baseline pictures (before any change): `C:\Users\UZAIR\.claude\design-kit\references\baseline-2026-10-13\footnote-*.png`, scans in `scan\footnote*.json`.

## 0. Decisions that are Uzair's (nothing here is final until he says so)

1. **Family or distinct?** Not answered by him. Recommendation applied: **a thin shared layer, a distinct face.** Shared (see `C:\Users\UZAIR\.claude\design-kit\family-layer.md`): light and dark following the system with the header toggle and no flash (`data-theme`, storage key `footnote:theme`), the accessibility baseline (4.5:1 text, visible focus ring, 24 px targets, reduced motion, axe in both themes), the honest tone, `frame-ancestors` for Portfolio OS and every security header, a skip link, one `h1`, titles, descriptions and a real `og:image`, a 4 px spacing rhythm. Not shared: typeface, accent, radius, first screen, label style, motion, logo. Reverting to the old kit means restoring `globals.css`, `layout.tsx` and the component classes; nothing in `src/lib` changes either way.
2. **The direction** (section 4): a result is a *leaf*, the printed page it came from, with the page number as the biggest type on it, the question's words in pink marker, and its citation set as the footnote under a short rule. Notes (limits, scope, what the marks mean) sit in a right-hand margin as run-in heads, not in boxes. Type: Libre Franklin and Red Hat Mono. It is a stronger move than ink-only chrome. Fallback if he finds pink wrong for a finance tool: keep everything and move the marker to hue 300 (the other end of the clean window, which Flowboard would then not get), or make it an ink underline plus bold with no colour; nothing else changes.
3. **The first screen shows a sample search, computed at build** from the repo's own data (Best Buy, 10-K 2023, page 30, with its rank and score). It is a new element on the page and a new claim of a kind ("this page came fifth for this question"), so he should see it. Section 7 says how it stays true.
4. **Colour in the Results charts changes meaning.** Today three hues (blue, orange, green, taken from Hindsight's validated palette) stand for three ways of searching. They are three steps of one thing (how much help the search gets), and the same hues mean other things in Hindsight, so the bars become ink, mid-ink and an outline. No number changes.
5. **How he is described: nothing changes.** The site says nothing about Uzair beyond the repository link, and nothing is added.
6. **Claims that change on the page:** none removed. Added: the sample caption (computed). The "What this does not do yet" box becomes a margin note with the same words.

## 1. What it is

Footnote lets a visitor ask a question about one of seven real company filings (670 pages) and see the pages most likely to hold the answer, with the question's words marked and a citation to copy, so they can check a figure at its source. It finds pages; it does not write answers, and only retrieval has been measured (no language model has run).

## 2. Who opens it, and what they do in the first 30 seconds

An AI.AT.Core interviewer or an engineer sent the link (from Uzair's portfolio, where it opens in a window, or from the README), with a couple of minutes. Within 30 seconds they must: see what a result is (a page of a filing, with the hit marked and a way to open the filing), read, in the same view, that it finds pages and does not write answers, run one search with one click and no key, and find the Results page. The first screen therefore shows a real page already, before anything is asked, next to the field that asks. It must also work in a 720 to 900 px window and on a phone.

## 3. Source material

1. **A page of a filing as the PDF's text came out**: lines kept, a table cell per line, `$` alone on a line, blank lines. `public/data/pages/BESTBUY_2023_10K.json`, page index 29 (page 30): "Capital Expenditures ... Total capital expenditures(2) $ 930 $ 737 $ 713 ... (2) Total capital expenditures exclude non-cash capital expenditures of $35 million ...". The baseline shows it as the #5 card (`fn-search-desktop-light-s3.png`); `.page-text` in `src/app/globals.css`.
2. **The filing's own footnotes**: that same page carries "(1)" and "(2)" markers in the table and the notes under it, the thing the product is named for. Same data file.
3. **The citation line**: "Best Buy, 10-K 2023, page 30 (https://...)", built by `citation()` in `src/lib/labels.ts` and pinned by the e2e regex `^Best Buy, 10-K 2023, page \d+ \(https?://`.
4. **The search's vocabulary**: "#5", "score 15.8", "This search ranks it #n of N pages", "The same question three ways: right filing given #3, company/year filter #3, all filings #3", the page FinanceBench marks. `src/components/Search.tsx` (`Results`, `isGold`), `public/data/examples.json` (`rank` and `gold` fields).
5. **The measurement**: hit rates by way of searching (13%, 31%, 44% in the top 10) that rise as the search is given more help: no help, the company and year filter, the right filing told (a ceiling). `public/data/results.json`, `src/components/ResultsView.tsx`.
6. **Names of filings**: form types and ids (`AMD_2022_10K`, `3M_2023Q2_10Q`, `JOHNSON_JOHNSON_2023_8K_dated-2023-08-30`), and the label a person would say, "Best Buy, 10-K 2023". `public/data/filings.json`, `src/lib/labels.ts`.
7. **The logo already draws the product's name**: a page with a short rule at its foot. `src/components/Header.tsx` (`Logo`).

Not found, so not used: I did not open any of the source PDFs, and the data files hold text only, so the original typeface and colour of a filing are unknown. Nothing here claims to match them. The category (document viewers, EDGAR) was not looked at beyond the site's own pictures.

Category conventions borrowed: a short rule above a footnote (the separator in a printed page), a folio, margin notes, a dog-ear for a bookmarked page. Looks avoided: manila-folder tabs, a PDF viewer's grey desk, a Bloomberg-terminal black and amber, newspaper dotted leaders.

## 4. The idea

**Directions considered**

- **A. "The leaf and its footnote" (picked).** From 1, 2, 3, 7. A result is the page itself, set as a leaf; the folio is the biggest type on it; marks are pink marker; the citation is its footnote under a short rule; the notes of the site sit in the margin. Palette: plum-black ink on a pale mauve ground, one pink marker. Type: Libre Franklin and Red Hat Mono. First screen: the question field and a real, computed page with its hit marked.
- **B. "The staircase".** From 5. Lead the whole site with the three hit rates as columns of rising height (no help, filter, ceiling). Rejected for the home page: it opens a tool with its weakest number (13%) before the visitor has done anything, and the product on `/` is the finder. Kept: the same staircase becomes the Results page's headline and, in small multiples, its by-type breakdown.
- **C. "The index".** From 4 and 6. Results as a table of contents with dotted leaders (rank, filing, page) and one page open under the chosen row. Rejected: it hides ranks 2 to 5 behind clicks, breaks five visible `article`s that the tests pin, and dotted leaders are a vintage-print flourish.

**The idea, in one sentence.** Footnote shows every finding as the printed page it came from, with the page number largest, the question's words marked in pink and the citation set as its footnote, and keeps everything else as plain text in one ink, with its notes in the margin.

Everything below follows from it: boxes exist only around a page (a leaf) and a field; pink means "a word from your question" and nothing else; the margin carries notes; the page number outranks the rank.

## 5. Token plan

### Colour

Light and dark values. Roles are what components use (`--accent`, `--accent-soft`, `--ok`, `--warn`, `--series-1..3`, `--shadow` are retired; `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--fg`, `--muted`, `--faint`, `--mark`, `--mark-fg`, `--bad` map to the names below). Hues are HSL, computed in `contrast.mjs`.

| Token | Light | Dark | Role | Used for / never used for |
|---|---|---|---|---|
| `ground` | `#f3ecf0` | `#1d151b` | the page, header, footer (hue 326 / 315, very low chroma) | words sit here. A pale mauve-grey, not cream. Never behind verbatim filing text. |
| `leaf` | `#fffcfd` | `#271e25` | a page of a filing (each result, the sample), the question field, selects | the only ground for verbatim text. Not a general card. |
| `leaf-2` | `#f8f1f5` | `#30262e` | hover on a link row, the recess under an opened "whole page" scroller | not a third card level |
| `ink`, `ink-2`, `ink-3` | `#22151d`, `#51424b`, `#675763` | `#f5ecf1`, `#d0c2cb`, `#ac9ca7` | `ink`: text, links, the footnote rule, the primary button fill, the focus ring, the chosen toggle's underline, the "no help" bar. `ink-2`: the dek, margin notes, secondary. `ink-3`: rank and score, the verbatim-adjacent meta, placeholder (12.5 px and up) | plum-black on purpose (hue 323): printer's black leaning to the marker, not Hindsight's blue-black nor Sayso's green-black |
| `rule`, `edge` | `#dccfd7`, `#8a7685` | `#3d3139`, `#85727d` | `rule`: the leaf's 1 px border, table rules, separators (decoration). `edge`: the border of a field, select, checkbox (must be found, 3:1) | `rule` never carries meaning |
| `mark` / `mark-ink` | `#ffb3d9` / `#22151d` | `#8c2c61` / `#fff4fa` | the marker: a word of the question found on a page (fill, with bold), the legend swatch in the margin note, the logo's foot line | hue 330 / 327. Never a text colour, border, outline, button or link colour. Never a chart colour. Pick any pink pixel: it is a marked word, its swatch or the logo. |
| `bar-mid` | `#7d6a76` | `#a08c98` | the middle value of the three-step charts only | with `ink` and an outline, so the steps differ in value as well as position |
| `alert` | `#a8231b` | `#ff9d95` | the load error and "Type a question first", always with the words | nothing else; no green "ok", no amber |

Hue arithmetic for the family rule (`family-layer.md`): accent **330** is outside 235-290 (40 degrees clear of its edge). Hindsight's data hues: red 0 is 30 away (rule: 20), amber 26-41 is at least 79 away, blue 213 is 117 away, greens 120 and 158 are over 170 away. Sayso 68 is 98 away; Agent Desk 142 is 188 away. Hindsight has no accent. What it leaves free for Flowboard: about 292 to 305 (25 or more from 330). The neutrals lean to 313-326 but have almost no chroma, so they read as near-black and near-white.

**Contrast, computed** (`contrast.mjs`, WCAG 2.x, final hex values):

| Pair | Light | Dark | Needs |
|---|---|---|---|
| ink on ground / leaf / leaf-2 | 15.14 / 17.26 / 15.84 | 15.44 / 13.98 / 12.58 | 4.5 |
| ink-2 on ground / leaf / leaf-2 | 8.10 / 9.23 / 8.47 | 10.43 / 9.44 / 8.50 | 4.5 |
| ink-3 on ground / leaf / leaf-2 | 5.79 / 6.60 / 6.05 | 6.86 / 6.21 / 5.59 | 4.5 |
| marked word (mark-ink on mark) | 10.65 | 7.39 | 4.5 |
| primary button label (leaf on ink) | 17.26 | 13.98 | 4.5 |
| alert on ground / leaf | 6.18 / 7.05 | 8.94 / 8.09 | 4.5 |
| edge on ground / leaf (field border) | 3.61 / 4.11 | 4.00 / 3.62 | 3 |
| focus ring (ink) on ground / leaf | 15.14 / 17.26 | 15.44 / 13.98 | 3 |
| bars: ink / bar-mid on ground | 15.14 / 4.31 | 15.44 / 5.70 | 3 |

Everything passes. Nothing is within 0.1 of its threshold; the lowest are `edge` on ground (light, 3.61) and `ink-3` on ground (light, 5.79). Not required, so not claimed: the pink fill against the leaf is 1.63 in light and 2.00 in dark. That is why a mark is also **bold** (a weight change in a monospace face does not move any letter) and the word is always in the text; the fill is emphasis, not the only signal. `rule` against ground is about 1.2: the leaf is found by its edge and its white, not by the border alone. Keep fields on `leaf`.

### Type

Two families. Mono only for verbatim filing text.

| Role | Family | Weights | Sizes | Why this face for this product | Loaded via |
|---|---|---|---|---|---|
| Everything the site says | **Libre Franklin** (variable, `wght` 100-900) | 800 the h1 and the figures; 700 headings and filing names; 600 labels and buttons; 500 nav; 400 body. 300 only at 40 px and up | h1 54 desktop / 34 phone, line 1.02, tracking -0.025em, two lines on purpose. Section heading 24/700. Folio 46/800 (38 on a phone), tabular, tracking -0.03em. Hit-rate figure 88/800 (64 phone), tabular. Dek 15.5/1.5 `ink-2`, max 64ch. Body 15. Labels and buttons 13 to 15/600. Margin notes 13.5/1.5. Meta (rank, score) 13, tabular, `ink-3`. Question field 17/1.4 | An American grotesque with a double-storey g and a heavy 800: numbers hold their own at 88 px and the folio reads as a page number, not a badge. `font-variant-numeric: tabular-nums` is on for every figure. Google's description: "an interpretation and expansion of the 1912 Morris Fuller Benton classic" (Franklin Gothic), led by Impallari Type. 800 against 400 is the weight jump the hierarchy relies on. Chosen from a specimen against the real page text and the 13% 31% 44% figures (`sans.png`), see section 9. | `next/font/google`, `subsets: ["latin"]`, no `axes` needed (only `wght`), no italics |
| Verbatim | **Red Hat Mono** (variable, `wght` 300-700) | 400 text; 600 for a marked word | 12.5/1.55 on a leaf, 13 in the opened scroller | Used only for the page text exactly as extracted, which is content, not a label voice. A weight axis, so a marked word can go to 600 without changing its width (PT Mono and Fragment Mono have 400 only, which would force a faux bold). Has the glyphs filings use (½ ¼ ¹ ² ³ § ● ✓ → × “ ” – —, checked in `zoom.png`). | `next/font/google`, `subsets: ["latin"]`, **preload on** (it is on the first screen) |

Licences: Libre Franklin, SIL Open Font License 1.1, "Copyright 2020 The Libre Franklin Project Authors" (`ofl/librefranklin/OFL.txt` in google/fonts, read 2026-10-13). Red Hat Mono, SIL OFL 1.1, "Copyright 2024 The Red Hat Project Authors" (`ofl/redhatmono/OFL.txt`, read the same day). Both are in this project's `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`: Libre Franklin `wght` 100-900, subsets cyrillic, cyrillic-ext, latin, latin-ext, vietnamese; Red Hat Mono `wght` 300-700, subsets latin, latin-ext. Self-hosted at build; no CDN link (the CSP says `font-src 'self'`).

```ts
const franklin = Libre_Franklin({ variable: "--font-franklin", subsets: ["latin"] });
const verbatim = Red_Hat_Mono({ variable: "--font-verbatim", subsets: ["latin"] });
```

GUESS to verify at build: the latin file sizes (the siblings' faces are 13 to 46 KB; a variable `wght` Libre Franklin is probably 40 to 60 KB; budget: under 120 KB of fonts in total, against Geist plus Geist Mono's 52 KB today), and that `next/font` raises no fallback-metrics warning for either. Zero shape in Red Hat Mono was not settled from the specimen; accept whatever the default is and do not switch on alternates.

**Glyph hole to know about**: the extracted text contains a private-use character that no font draws (a bullet from the PDF; it shows as an empty box on page 37 in `fn-search-desktop-light-s3.png`). It is verbatim, so leave it; if it bothers the eye, a display-only replacement with a plain bullet is allowed in the renderer, never in `src/lib` ranking code.

No tracked all-caps anywhere; no small mono labels. `.eyebrow` is deleted.

### Shape and depth

- **Radius by role.** Leaf: **0**, square like paper, with one exception: the page FinanceBench marks gets a cut corner (a dog-ear, 18 px, drawn with `clip-path` and a folded triangle in `edge`). Fields, selects, buttons: **4 px**. The mark behind a word: **2 px**. Checkbox: 2 px. Chart columns: 0. No pill shapes anywhere (the example buttons become text links, the "FinanceBench's evidence page" pill becomes words plus the dog-ear, the state pills on `/how` become a drawn square plus words).
- **Elevation: two steps, no shadow.** Ground (flat) and leaf (1 px `rule` border). No blur: the sticky header is opaque `ground` with a 1 px `rule` under it. Borders over shadows. `--shadow`, `shadow-panel`, `backdrop-blur` are removed.
- **A box is allowed only around a leaf or a field.** The form, the "What this does not do yet" note, the filter row, the explanatory paragraphs, the glossary, the "Not measured yet" section sit on the ground. Tables are ruled, not boxed. No card inside a card (`/results` nests tiles inside a panel today).
- **The footnote rule.** A 96 px, 1.5 px `ink` rule, left-aligned, above the citation at the foot of every leaf, and above the "Not measured yet" section on `/results` (limits sit at the foot of the page, as a footnote does). Nothing else uses it.
- **Selected and focus.** A chosen toggle (top 1/3/5/10) is a 3 px `ink` underline and weight 700, not a filled segment. Primary button is `ink` fill with `leaf` text (hover: `ink-2`). Focus is a 2 px `ink` outline with 2 px offset on every control, including on the primary button.

### Space

4 px base; steps 4, 8, 12, 16, 24, 32, 48, 64. Inside a leaf: 24 px side padding, folio to filing name 14, head to text 8, text to toggle 12, toggle to footnote rule 16. Between leaves 32. Between the form and the first leaf 24; between page sections 48. Desktop grid: main column **720 px**, gap 56, margin column **304 px**, container 1080 px centred (left edge at 180 on a 1440 screen). Notes in the margin 13.5 px with 14 px between them. Prose measure at most 64ch (dek), 72ch (Results text). Under 1024 px the margin collapses: the "What this does not do yet" note goes straight after the dek, the other notes after the thing they annotate. Phone side padding 20; every control at least 44 px tall on a phone (the primary), at least 32 px for links in a row, never under 24 px.

### Motion

**The one moment: the ranking re-sorts.** When the visitor changes what is searched (the scope select, "Narrow by the company and year", or picks another example for the same filing), the leaves that stay on the list slide to their new rank (FLIP: measure before, apply `translate` with the Web Animations API, 260 ms ease-out) and new leaves appear without animation. That is what the product is about (the same question ranks a page differently as the search is given more help), shown once, only when it is true. A new question, the first search, "Show the whole page" and every hover do not animate (hover and focus 150 ms). No arrival fade, no count-up, no bar growth (the charts are static).
Reduced motion: no animation at all (the existing global rule keeps durations short, but a delayed transform would still run; set the animation off explicitly). GUESS to verify in the build: that FLIP on keyed `article`s works with the existing key `${doc}#${page}`, and that it does not make `toBeInViewport` or click tests flaky; if it does, ship without it and keep everything else. The View Transitions API was rejected because its overlay captures clicks while it plays.

## 6. Layout concept

Skeleton on every page: **a page and its margin.** A 720 px main column holds the thing you work on (the question, the leaves, the charts, the table); a 304 px margin on the right holds notes (limits, scope, what the marks mean, the search options). On `/results` and `/how` the margin carries the same kind of note (the limits and the glossary link), and the page is single-column below 1024 px. This is the pattern of sidenotes in long-form reading (Tufte-style); what Footnote does with it is carry its honest limits and its form options there, and nothing decorative.

- **`/`**: the question, then a leaf. With nothing in the address the leaf is the computed sample; with a search it is the list of five leaves, the first one open at the top of the column. The margin holds the limits, the examples, the FinanceBench select, the scope select and the "Narrow" checkbox (all still in the one `form`), the scope line and the marks note.
- **`/results`**: the readout as three columns of rising height, then small multiples of the same shape by type of question, then prose, glossary, the ruled table of every number, and the "Not measured yet" footnote.
- **`/how`**: a short ruled summary, the path of a question as one line with five stops (three filled, two hollow), the parts as a ruled table with a drawn square for each state, then the limits.

### `/` desktop 1440, nothing in the address (picture: `mock-light.png`, `mock-dark.png`; the sketch puts the example links under the button, the plan moves them to the margin)

```
+----------------------------------------------------------------------------------------------+
| [#] Footnote   Search  Results  How it works                                    GitHub   (o) |  56, ground, 1 px rule; current page = 2 px ink underline
|                                                                                              |
|  Find the page behind                      (54/800)          What this does not do yet.      |  margin col x 956-1260, 13.5/1.5, run-in head 700
|  the figure.                                                 It finds pages, it does not     |
|  Ask a question about a company's filing ...  (15.5, 64ch)   write answers. Writing one      |
|  ... 7 filings (670 pages) ... no server and no key.         needs a language model, and     |
|                                                              none has been run ... Results.  |
|  Your question                                                                               |
|  +----------------------------------------------------+      Try an example                 |  group named "Try an example", text links, 32 px rows
|  | What was Best Buy's capital expenditure in ...?    |      Best Buy's capital spending    |
|  +----------------------------------------------------+      Boeing's production rates ...  |
|  [ Find the pages ]  (44 px, ink)                            ...                             |
|                                                              Or try one of the 31 FinanceBench|
|  A sample, not your search: this question, searched in       questions  [Choose a question v]|
|  Best Buy, 10-K 2023 only. This page came fifth.   (13, ink-3)  Search in  [All 7 filings v] |
|  +----------------------------------------------------+      [x] Narrow by the company and  |
|  | p. 30  Best Buy, 10-K 2023              #5 . score 15.8|      year in the question        |
|  | ...                                                |                                      |
|  | Total [capital] expenditures(2)                    |      Marks. Pink is a word from the  |
|  | $ / 930 / $ / 737 / $ / 713                        |      question, found on the page.    |
|  | (2) Total [capital] expenditures exclude non-cash  |      Left plain, because they are on|
|  |     [capital] expenditures of $35 million ...      |      most of the pages searched:     |
|  | Show the whole page                                |      best, buy, fiscal, 2023.        |
|  | ____                                               |                                      |
|  | Best Buy, 10-K 2023, page 30   Copy citation   Open the filing                            |
|  +----------------------------------------------------+                                      |
+----------------------------------------------------------------------------------------------+
```

Unequal on purpose: the folio "p. 30" (46/800) is nearly four times the verbatim text and larger than anything but the h1; the leaf is the widest boxed thing and the only one; the margin is small type. At 1440 x 900 the leaf's head and the first marked line are on screen (aim: the first mark by y 700); its foot comes into view with a short scroll. While the filings load, the form area shows the loading state in place and the leaf is already there, because it was computed at build.

### `/` with a search (desktop; no sketch)

The h1 stays (it is pinned) but shrinks to 40/800 and the dek and sample caption are gone; the question field is two rows with the button beside the examples; the heading "The 5 best pages" (24/700) with "Copy link to this search" as a text button at its right sits above the five leaves; the scope line and the marks note are in the margin. The five leaves have the same anatomy and the same size: scores such as 18.1, 18.0, 16.9, 16.3, 15.8 are close, and the page says a high rank is not an answer, so no leaf is made larger for its rank. When a benchmark question is chosen, "What FinanceBench says." appears above the list as a run-in note (no box, no left bar), and FinanceBench's evidence page, if it is among the five, gets the dog-ear and the words "FinanceBench's evidence page" in its head.

### A leaf (all results and the sample)

```
+--------------------------------------------------------------+
| p. 30   Best Buy, 10-K 2023                  #5 . score 15.8 |  folio 46/800; filing 15/700; meta 13 tabular ink-3, right
|                                                              |
| …                                                            |  verbatim, Red Hat Mono 12.5/1.55, lines kept
| Total [capital] expenditures(2)                              |  [..] = mark: pink fill, 600
| $                                                            |
|  930                                                         |
| ...                                                          |
| Show the whole page                                          |  13/600 underlined text button (aria-expanded)
| ____                                                         |  96 px ink rule, 1.5 px
| Best Buy, 10-K 2023, page 30      Copy citation   Open the filing (external-link icon)
+--------------------------------------------------------------+
```

The aria-label stays `Rank n: DOC, page p` and the element stays an `article`. The sample on the first screen is a `figure`, not an `article` (tests count `article`s and expect none before a search).

### `/` phone 390

```
| [#] Footnote  Search Results How  (o) |  56
| Find the page behind                  |  34/800
| the figure.                           |
| Ask a question about a company's ...  |  15.5, 4 lines
| What this does not do yet. It finds   |  margin note inline, 13.5
| pages, it does not write answers ...  |
| Your question                         |
| [ What was Best Buy's capital ... ]   |  17/1.4, 3 rows
| [ Find the pages ]  (full width, 48)  |
| Try an example                        |
| Best Buy's capital spending           |  link rows at least 44 high
| Boeing's production rates for 2023    |
| ...                                   |
| Or try one of the 31 ... [v]          |
| Search in [All 7 filings v]           |
| [ ] Narrow by the company and year .. |  20 px box in a 44 px row
| A sample, not your search: ...        |
| +-----------------------------------+ |
| | p. 30  Best Buy, 10-K 2023   #5   | |  folio 38
| | verbatim, wraps, no sideways scroll| |
```

On a phone the first screen is the form, because that is the action; the leaf follows within one more screen, with its first marks visible by the second.

### `/results` desktop 1440 (no sketch)

```
| What has been measured                                       (54/800)                        |
| FinanceBench has 150 questions about real filings ... (dek, 72ch)                            |
| Is the evidence page in the top 10 results?  (24/700)      top 1   top 3   top 5   top 10    |  text toggles (radio labels), chosen = 3 px ink underline
|                                                                                              |
|  13%               31%                  44%                  (88/800, tabular)               |  one `ul` named "All 150 questions", three `li`
|  []                [][][]               [ outline ]           columns stand on one rule, 0-100% scale, 240 px = 100%
|  ----------------------------------------------------------------------------------------   |
|  Search all 360 filings   + company and year filter   Right filing given (a ceiling)         |  13.5/600 labels, notes 13.5 ink-2
|  Keywords only, no help.  First pick the filings ...  Told which filing to look in: ...      |
|                                                                                              |
| In plain words. Given only the question, keyword search puts a page ... 13% ... 31% ... 44%  |  one `p`, 17/1.5, no box
| By type of question   (2 x 2 small multiples of the same three columns, 96 px tall, values above) |
| What to take from it  (run-in bold leads, no bullets)                                        |
| What the words mean   (dl, terms 700, 11rem column)                                          |
| Every number          (ruled table, 2 px ink rule under the head, current column 700)        |
| ____ (96 px rule)                                                                            |
| Not measured yet                                                                             |
```

The columns use the three `bar` values (`ink`, `bar-mid`, an outline in `ink` with no fill for the ceiling), so the chart reads in greyscale and for colour-blind viewers; the label under each column says what it is. The same shape repeats in the four question-type groups, which makes the page one picture seen at two sizes. The scale is 0 to 100%, not stretched.

## 7. Voice

Plain, careful, first person where the author speaks ("I added five nicknames after seeing which questions it missed" stays). It says what it found, how sure that is, and what it did not do.

1. Say what the page is and where it is: company, form, year, page number, always together ("Best Buy, 10-K 2023, page 30").
2. State a limit in the sentence where it bites: "A high rank means the page's words match your question, not that the page answers it." stays under the results.
3. No product-marketing words (powerful, intelligent, seamless, insights), no exclamation marks, no emoji. Never say the site answers, reads, understands or finds "the answer": it finds pages.
4. A control says what it does: "Find the pages", "Copy citation", "Open the filing", "Show the whole page", "Start over". No "Learn more", "Get started".
5. Prefer commas to middle dots in running text; run-in heads end in a full stop ("Limits." style), never a colon or all caps.

Sample lines (existing copy kept where it is already right; T marks a string a test pins):
- Headline: "Find the page behind the figure." (T `h1` text; the full stop is not pinned, the words are). `/results`: "What has been measured" (T). `/how`: "How it works" (T).
- Primary button: "Find the pages" (T). Secondary: "Start over" (T). Group label "Try an example" (T). Field labels "Your question" (T), "Search in" (T), "Narrow by the company and year in the question" (T), "Or try one of the 31 FinanceBench questions about these filings" (T, begins "Or try one of the").
- Margin note: "What this does not do yet. It finds pages, it does not write answers. Writing an answer needs a language model, and none has been run on this project yet. What has been measured is on the Results page." (same words as today; the box and the bold colon go).
- Sample caption (new, computed): "A sample, not your search: this question, searched in Best Buy, 10-K 2023 only. This page came fifth." The question, filing label, rank and score come from running the real search at build.
- Empty: "None of the words in your question appear in the pages searched. Some things to try:" (T "Some things to try"). Error: the failure message plus "Try again" (T). Question missing: "Type a question first, or pick one of the examples below." (T "Type a question first"; with the examples in the margin the word "below" becomes "at the right", so change it with the layout: on a phone it is still "below"; say "or pick one of the examples").
- Tooltip: the score keeps `title="Search score: higher means the page's words match the question more closely"`.

Facts that must stay true, with sources:
- 7 filings and 670 pages from AMD, Boeing, Amcor, Best Buy, 3M, Johnson & Johnson and Ulta Beauty (computed from `filings.json` in `Search.tsx`; sum of pages 121+190+156+75+92+27+9 = 670); 31 FinanceBench questions about them (`examples.length`).
- The search runs in the browser, with no server and no key (README "The site"; e2e "no request leaves the site").
- It finds pages and does not write answers; no language model has been run; only retrieval is measured (README Status; `/results` "Not measured yet"; `/how`).
- 150 questions, 360 filings, 53,399 pages; hit rates 13% / 31% / 44% (top 10), and every other percentage on `/results`, are read from `results.json` (written by `python -m footnote.site_export`); none is typed into copy. The filter's counts (148 of 150, 128 of 150 and so on) are the same file's `filter` block.
- The FinanceBench reference answers and evidence text are not shipped; only the page numbers it marks (README; `/how`).
- The ranking is the Python's, held equal by the parity test; the highlighting is display only (README).
- "This is an evaluation project, not investment advice, and the search can be wrong" in the footer (T "not investment advice" on every page).
- New: the sample's text is a verbatim slice of `BESTBUY_2023_10K.json` page 30, its rank and score are what `Corpus.search` returns for that question over that filing, and the "left plain" words are what `distinctTerms` returns. A unit test asserts all three, so the sample cannot drift when the data is regenerated. **Fallback** if running the search at build is a problem: ship the slice as a literal, drop the rank and score from the sample, and keep the substring test.

## 8. Principles that set it apart

1. **The leaf is the only boxed thing.** Take any screenshot: the only bordered panels are leaves and fields. No box around a paragraph, a note, a form, a chart or a table.
2. **Pink is a word from your question.** Pick any pink pixel on any page: it is a marked word, the marks swatch in a note, or the logo's foot line. No pink button, link, border, chart or badge.
3. **The page number is the biggest type on a leaf.** "p. 30" is at least 3.5 times the verbatim text and larger than the rank, which is 13 px.
4. **Every leaf ends in its footnote.** A 96 px ink rule, then the citation line and its two actions, and nothing under them.
5. **Notes live in the margin, as run-in heads.** "What this does not do yet.", "Marks.", "Scope." in bold at the start of a sentence; no eyebrow, no all-caps, no callout, no side bar.

## 9. Second pass: defaults I removed

| First idea | Why it was a default (tell, wave) | Revised to |
|---|---|---|
| Cream paper, a serif for headings, a rust accent: "filings are printed documents" | warm editorial, second-wave cluster 1 | Checked the product's own material first: the data holds extracted text, one cell per line, with `$` alone on a line, so the honest page is a ragged monospace dump, not set type; no file here says what a filing's paper or typeface looks like (I did not open the PDFs). Nothing in the repo demands cream or a serif, so: pale mauve-grey ground, a grotesque, a pink marker |
| Keep the existing pale-yellow mark (`--mark #fff0a8`) | same hue family as Sayso's highlighter (hue 68); two sites would share "yellow marker" | pink marker at hue 330, in the clean 292-338 window, 98 degrees from Sayso |
| Ink-only chrome with no accent, like Hindsight | would put two sites on the same device and leave Footnote with only type to differ by | one accent, used for one job (the question's words), everything else ink |
| A coloured primary button and links in the accent (stock "accent for everything interactive") | first-wave accent tell, and it would turn pink into a brand colour instead of a meaning | primary button is `ink`, links are underlined `ink`, focus is `ink`; pink is only ever a marked word |
| Master and detail: ranked list at the left, the open page at the right (PDF viewer, Linear) | stock app shell; hides ranks 2 to 5; five visible `article`s are pinned by tests | five leaves in a column, same anatomy, the margin carries the notes |
| Make leaf #1 larger "because it is first" | hierarchy by rank claims what the page says it does not (scores are 18.1, 18.0, 16.9, 16.3, 15.8) | equal leaves; hierarchy comes from the folio, the marks and the footnote |
| "Tick and tie" tick marks beside figures (audit working-paper vernacular) | implies the tool checked a figure; it only finds pages | not used; the check is the visitor's, at the source |
| Blue, orange and green series colours in `/results` (copied from Hindsight's validated palette) | three hues for three steps of one thing; the same hues mean model call, API call and waiting in Hindsight, so Portfolio OS would show two meanings | ink, mid-ink, outline; direct labels |
| Three identical tiles with a swatch, inside a panel, above bars | stat-tile row and nested cards (scanner `stat-tiles`, `nested-cards`) | one `ul`, three columns of true height on one baseline, then the same shape in small multiples |
| Status dots (green, amber) and pill chips on `/how`; a numbered-circle card row for the path | random status colour, pills, SaaS card kit | a drawn square (filled, half, hollow) plus the words; the path is one line with three filled stops and two hollow ones |
| Left side bars (`border-l-4`) on the FinanceBench note and the "Not measured yet" section | side-accent-border tell | run-in note; a 96 px footnote rule above "Not measured yet" |
| Dotted-leader index (TOC style) for the five results | vintage-print flourish; hides pages | rejected (direction C) |
| Folder tabs or a manila-folder frame for "filings" | skeuomorphic paper vernacular that Sayso's forms already use | one dog-ear, only on the page FinanceBench marks |
| View Transitions for the re-sort | its overlay swallows clicks while it plays, risk to 38 e2e tests | FLIP with `translate`, one 260 ms moment, off under reduced motion |
| Width-axis Archivo (compact index, expanded figures) | Hindsight already leans on a width axis for its gutter | Libre Franklin, one width |
| Public Sans (US-government grotesque) | same lineage as Libre Franklin without its 100-900 range and its 800 | Libre Franklin |
| Schibsted Grotesk (runner-up) | more character, but heavier and wider at 15 px body in the specimen, and a newspaper-brand origin leans editorial | not used; fallback if Libre Franklin loads badly |
| IBM Plex Mono or Source Code Pro for the page text | dotted zero and a code-editor look on money amounts; Plex is seven static files | Red Hat Mono, one variable file |

"Have I seen this exact thing?" Checked against the baseline pictures of Footnote (`footnote-desktop-light.png`: indigo, Geist, a form in a white rounded panel, pills), against Hindsight's and Sayso's `DESIGN.md` (ink chrome, gutter and track; sage docket, yellow fill), and against `craft-notes.md` (Linear: real thing first; tonsky and Poolsuite: one commitment). I did not re-open `references/good/`. The margin column is the sidenote layout of Tufte-style essays; the risk is that it reads as "a blog template", which the 54/800 grotesque, the boxed leaf and the form in the margin are meant to prevent, and the first build should be judged against that. Not seen elsewhere: a computed sample page, with its rank, as the first screen of a search tool, with the page number as the loudest type on it.

## 10. Anti-list for this product

- No indigo, violet or blue accent. No gradient, glow, blur or glass; no shadow at all. No emoji.
- No pill chips, no tracked all-caps eyebrows, no small mono labels, no `A · B · C` meta strings, no numbered markers on things that are not a sequence (the five-step path is a sequence), no arrow on a link (the external-link icon on "Open the filing" is allowed; so is none).
- No box around a sentence, a form, a note, a chart or a table. No card inside a card. No left or top accent bar on a panel.
- No pink on anything but a marked word, its swatch and the logo; no colour for a chart series.
- No bigger leaf for a better rank. No claim that a page "answers" or "contains the answer": the page matches the words.
- No count-up, fade-up, bounce, or growing bars. One re-sort.
- No hero image, logo wall, testimonial, stock photograph, or invented company. Filing names, numbers and rankings are the repo's.
- No invented number: every figure on a page is read from `results.json`, `filings.json`, `examples.json` or computed by the search.
- No serif and no cream ground (second-wave cluster 1) unless Uzair asks for it.

## 11. Sibling check

| Axis | Footnote (this plan) | Hindsight | Sayso | Flowboard, Agent Desk, Portfolio OS |
|---|---|---|---|---|
| Primary typeface | Libre Franklin (+ Red Hat Mono for verbatim) | Mozilla Headline (+ Atkinson Hyperlegible Mono) | B612 (+ B612 Mono) | not Libre Franklin or Red Hat Mono; Agent Desk keeps Mona/Hubot/Martian |
| Accent | pink marker, hue 330 (`#ffb3d9`, dark `#8c2c61`), only on the question's words | none (blue-black ink; data hues 0, 17, 26-41, 120, 158, 213) | highlighter yellow, hue 68 | stay out of 235-290 and within 25 of 330; Flowboard's clean window is about 292-305 |
| Radius | leaf 0 (dog-ear), fields and buttons 4, mark 2 | 3 / 6 / 8 | 14 / 10 / 5 / 2 | avoid 0 / 4 / 2 together |
| Label style | run-in bold lead-ins in a margin note ("Limits."), field labels plain 600 above the field | plain 500 sans in a gutter | caption under a ruled value | any other |
| Skeleton | a 720 px column plus a 304 px margin of notes | label gutter and track | left-aligned docket of forms; welcome = talk left, paper right | not a margin-notes column |
| Motion | the ranking re-sorts when the search changes | a run draws itself once | the fold with a highlighter stroke | something else |

Shared on purpose (the thin layer): the theme mechanism and the toggle at the right end of the header, the accessibility baseline, the skip link and landmarks, the honest tone, the 4 px rhythm, the footer's role and its "not investment advice" line, the security headers and `frame-ancestors`. Footnote has no "Open in Hindsight" control today (README: Hindsight does not read Footnote's source yet) and none is added.
Two things to know. Footnote's marker is a highlighter, like Sayso's, but in a different hue and role: Sayso's yellow marks what the desk chose, on buttons and seats; Footnote's pink marks words in text and never a control. Footnote and Hindsight both keep chrome in ink; they differ in face, ground, radius, labels, skeleton and motion.

## 12. Constraints from the repo

- **Headers and CSP** (`next.config.ts`): untouched. `default-src 'self'`, `font-src 'self'`, `img-src 'self' data: blob:`, `connect-src 'self'`, `frame-ancestors 'self' https://uzair-khan-lac.vercel.app`; e2e "the content policy names no other site" and "no request leaves the site while using it". Fonts only through `next/font` (self-hosted); no `<link>` or `@import`; no external image. The `og:image` must be a file in the project (a static `src/app/opengraph-image.png` plus `alt`), not a remote URL.
- **`src/lib` is not edited** (parity test: TS BM25 equals the Python, page for page, scores to five decimals; `highlight.ts` is display only but is tested; do not change what it marks, see next point). The build-time sample may import and call `Corpus`, `DocResolver`, `markTerms`, `distinctTerms`, `bestWindow`, `pieces`.
- **Marking is exact-token** (`pieces` marks a word only when it is one of the question's tokens, with no stemming, because BM25 matches the same way). On the sample, "capital" is marked and "expenditures" is not, since the question says "expenditure". That is true to the ranking and is left as it is; do not add looser marking without telling Uzair, because "Marked words are your question's own" is a claim on the page.
- **Tests** (about 30 unit under `vitest`, 38 e2e in `tests/e2e/site.spec.ts`, axe in both themes on `/` before and after a question, `/results`, `/how`). Copy and structure they pin, which change only together with the tests:
  `/`: h1 contains "Find the page behind the figure"; `getByLabel("Your question")` (textarea; empty-question alert with text "Type a question first" and focus returns to it); button "Find the pages"; Enter searches, Shift+Enter adds a line, and **before a search there are zero `article` elements** (so the sample is a `figure`); after a search heading `/The 5 best pages/` (focused and in the viewport), five `article`s with `aria-label` `Rank n: DOC, page p`, `article mark` count above zero and no mark equal to "buy" for the Best Buy question; `role=status` text "Recognised Best Buy", "Searched all 7 filings", "Searched inside", "None of the demo's companies"; "left plain because they are on most of the pages searched"; group named "Try an example" with buttons whose names match `/Boeing/`; `getByLabel(/Or try one of the/)` is a select whose option index 1 and 3 are chosen; `getByLabel("Search in")` select, index 2; checkbox labelled "Narrow by the company and year in the question"; `?q=`, `&in=`, `&filter=off` in the address and restored on reload; button "Copy link to this search" then "Copied" and the clipboard equals the page URL; "Start over" empties the field and the address; button "Copy citation" then "Copied" with text matching `^Best Buy, 10-K 2023, page \d+ \(https?://`; button "Show the whole page" then "Show less" with `aria-expanded`; `getByText("Which filings can I ask about?")` opens a list with a link named `/Open the filing for Best Buy/`; "What FinanceBench says" as the text of its own element; text matching `/marks page \d+ of/` in one element; "The same question three ways"; heading "No page matches" and "Some things to try"; a failed `filings.json` shows an alert and "Try again" works; the theme button named `/Switch to (dark|light) theme/` and the `footnote:theme` key.
  `/results`: h1 "What has been measured"; heading `/top 10 results/` and `/top 3 results/` after clicking a label containing "top 3"; the list named "All 150 questions" with exactly three `li` containing "13%", "31%", "44%" in order (and "8%" first for top 3); a `p` containing "In plain words" and "13%"; four `group`s named `/questions$/`, the first containing "With filter"; link `/New to these terms/` scrolls to heading "What the words mean" with `term`s "FinanceBench", "Top 10", "Keyword search (BM25)", "Ceiling", "MRR"; a table with 12 body rows whose **first row is the "All questions" group's "All filings" row containing "13%"** (do not reorder the groups); heading "Not measured yet".
  `/how`: h1 "How it works"; `row` named `/Judge/` containing "Built, not run"; `row` `/Keyword search/` containing "Measured"; heading "In short"; link "Try the search"; footer link "Code on GitHub" and text "not investment advice" on `/`, `/results` and `/how`; 404 heading "No such page".
  Phone (390): no sideways scroll on all three pages; the theme button inside 390; all four result groups inside 0 to 390; results scroll into view after a search.
- **Accessibility**: axe clean in both themes; focus ring on every control; targets at least 24 px, primary 44 px on a phone. The baseline phone scan listed 19 of 39 targets under 24 px on the search state (`fn-search.txt`): the "Footnote" logo link (23 px), the 16 px checkbox, the "Which filings can I ask about?" summary (20 px), five "Open the filing" links (20 px) in that list, plus the footer links. Fix by making every one of them at least 32 px tall (padding, not larger type), the checkbox a 20 px square inside a 44 px label row, and the summary 44 px. The scanner counted visually hidden radios on `/results`; those are `sr-only`, not targets, but the labels over them (the top-k toggles) must be at least 44 px high.
- **Icon and share image**: `src/app/icon.svg` (today an outline page with an indigo foot line) becomes an ink tile with a leaf glyph and a foot line in `mark`; the header `Logo` is the same drawing at 20 px, with the foot line in the theme's `mark`. `src/app/opengraph-image.png` (1200 x 630, new): the h1 and the sample leaf, taken from the built site. `viewport.themeColor` becomes `#f3ecf0` and `#1d151b`. Metadata `description` and `title` keep their words.
- **Pictures the code can regenerate**: `npm run screenshots` (`scripts/screenshots.mjs`) if the README uses them; check what it writes before running it.
- **Do not touch**: `web/AGENTS.md` and `web/CLAUDE.md` (untracked, not part of this change).
- **Dev**: port 3050 (Portfolio OS also uses 3050: run one of them with `-p 3055`). Framed by Portfolio OS: check windows 720 and 900 px wide, not only 1440 and 390.
- **Build order**: tokens, fonts, header and footer; the leaf component and the sample; the form and the margin; results list and the dog-ear; the re-sort; `/results` charts, table and prose; `/how`; icon, `og:image`, then the checks below.

## 13. Acceptance

- Scanner on `/`, on `/?q=What%20was%20Best%20Buy%27s%20capital%20expenditure%20in%20fiscal%202023%3F`, `/results` and `/how` (baseline: 2 signals MILD on `/` and the search state, 4 SLOPPY on `/results`, 2 on `/how`): at most one signal, or each remaining hit explained. Expect a "dominant accent" in pink (the mark, by design) and `og:image` present.
- Pictures checked: 1440 light and dark for `/` (sample), the search state, the search state with a FinanceBench question (dog-ear), `/results`, `/how`; 390 light for `/` and the search state; 720 and 900 px light for `/`. Look at the dark `/` for "acid on black" (the mark is a muted `#8c2c61` on a plum-grey leaf, so it should not read as neon) and at the light `/` for "pink site".
- Contrast: the figures in section 5 hold in the built CSS (re-run `contrast.mjs` with the final values).
- No fact, number or claim added that is not sourced (section 7); the sample's text, rank, score and left-plain words are computed and have a unit test.
- Lint, typecheck, `npm test` (30 unit including parity), `npm run build`, then `CI=1 npx playwright test` with nothing on the port (38 e2e, axe in both themes) pass; any changed assertion is listed with the reason.
