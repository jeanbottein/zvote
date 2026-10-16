# zvote design

How the web app looks, and why: the system behind `clients/web/src/style.css`
and the voting systems' stylesheets. It is written for people and for agents:
read it before changing how anything looks, and keep it true when you do.

People open zvote on a phone, often from a link in a chat app, once. It must
be obvious at first sight, calm, and trustworthy: a ballot is a private act, a
result is a fact.

## Principles

1. **Colour is meaning.** Red, yellow and green belong to the seven mentions,
   Bad to Excellent. They appear where a mention is shown and nowhere else, so
   that a voter never reads a button or a background as a judgment. The
   interface itself is neutral paper and one blue ink. Danger red is kept for
   what cannot be undone, and always comes with words.
2. **Paper and ink.** Surfaces are quiet; what can be acted on is ink
   (`--accent`). The ballot is the one sheet raised above the rest: the thing
   the voter holds.
3. **Obvious, then calm.** One primary action per region, labels before icons,
   plain sentences. A majority judgment row shows its seven colours until it
   has a mention, then steps back.
4. **Nothing moves under a finger.** Hover and focus change colour, shadow or
   outline, never size, border width, padding or weight.
5. **One definition per colour.** Each token is declared once for light and
   dark (`light-dark()`). A theme is a palette over the same tokens.
6. **Mobile first.** A phone held upright is the design; wider screens get
   room, not new layouts.

## The logo

The mark is the owner's `icon.svg` at the repository root, an Inkscape file
and the source of truth: a hexagonal ballot box whose bands are the mentions'
colours, red at the top to green at the bottom, with the ballot's slot across
the yellow band.

| Where | File | How |
|---|---|---|
| Header, Home | `src/ui/Logo.tsx` | Inline SVG. Its frame and the paper between the bands take the `--logo-*` tokens, so on a dark page it has a light frame and dark paper, the original's inverse. The bands and the slot keep the owner's colours. |
| Browser tab | `public/favicon.svg` | Square viewBox, and its own `prefers-color-scheme: dark` variant for dark browser chrome. |
| Safari before 26 | `public/favicon-32.png` | 32 px, transparent: Safari only shows SVG favicons since 26. |
| iOS home screen | `public/apple-touch-icon.png` | 180 px on white: iOS paints transparency black, and rounds the corners itself. |

- The mark always stands beside the name, "zvote", in lowercase, 750 weight,
  tight tracking (`.brand`). It is decorative (`aria-hidden`): the name is the
  link's text.
- 30 px wide in the header, 64 px on Home. Not below 24 px, where the gaps
  between the bands close up. Keep a quarter of its width clear around it.
- Never recolour the bands, stretch it, outline it, or set it on anything but
  the page's own surfaces.
- To change it: `Logo.tsx` and `favicon.svg` both hold the drawing of
  `icon.svg` without the editor's data (sodipodi and inkscape attributes, path
  effects, gradients pointing at other gradients). Copy the new path data into
  both; keep the tight viewBox (`-15 14 230 202`) for the inline mark and the
  square one (`-16 -1 232 232`) for the favicon; render the two PNGs from the
  favicon with headless Chrome, emulating light.

## Colour

Every colour is a custom property in the Tokens section of `style.css`,
declared once as `light-dark(<light>, <dark>)`. Names say what a colour is
for, not what it looks like, so that a theme can repaint them. The mentions
are the exception: `mentions.css` owns them.

**Surfaces**, from the page up to what the voter holds:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#f4f5f7` | `#0f1115` | The page. |
| `--surface` | `#ffffff` | `#171a20` | Panels (`.panel`). |
| `--surface-raised` | `#ffffff` | `#1f232a` | What is held: the ballot, dialogs, the chosen segment; the gap inside a chosen mention's ring. |
| `--surface-sunken` | `#eef0f3` | `#111318` | Tracks and wells: segmented controls, the join code, badges, bar tracks, a confirmation. |
| `--surface-hover` | `#f4f5f7` | `#232832` | A secondary button or an approval choice under the pointer. |
| `--field` | `#ffffff` | `#111318` | Text fields, selects, approval choices. |
| `--card` | `#ffffff` | `#1b1f25` | One option's result inside the results (the results graph reads it). |
| `--hover` | 8 % of the text colour | | A tint over any surface (icon buttons, list rows): it follows the text it sits under, toasts included. |

**Text and lines:**

| Token | Light | Dark | Role |
|---|---|---|---|
| `--fg` | `#15171c` | `#eceef2` | Text; the ring around a chosen mention. |
| `--muted` | `#5b6170` | `#a3a9b6` | Secondary text: hints, meta, counts, placeholders. |
| `--border` | `#e1e4e9` | `#2b3039` | Hairlines between and around things: decoration. |
| `--border-strong` | `#7c8290` | `#727988` | A control's edge (fields, secondary buttons, boxes): 3:1 on every surface. |
| `--mention-edge` | black 14 % | white 16 % | The hairline around a mention's colour, so that pale ones keep their shape on white and dark ones on graphite. |

**Ink**, what can be acted on. Blue: the colour of a ballpoint pen and of
links, and of none of the mentions; people who confuse red and green tell it
from both.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--accent` | `#2f4ad0` | `#4560e8` | Primary buttons, ticks, approval bars, the winner's outline. |
| `--accent-hover` | `#2539a8` | `#3a52d6` | Darker in both schemes, so white text keeps its contrast. |
| `--accent-fg` | `#ffffff` | `#ffffff` | Text and ticks on the accent. |
| `--accent-text` | `#2f4ad0` | `#9db0ff` | Links and ink-coloured text on surfaces. |
| `--accent-soft` | `#e9edfc` | `#1b2139` | Tinted grounds: callouts, chosen approvals, name chips, Live. |
| `--focus` | `#2f4ad0` | `#9db0ff` | The focus ring. |

**Danger and warning:**

| Token | Light | Dark | Role |
|---|---|---|---|
| `--danger` / `--danger-hover` | `#c42d27` / `#a6241f` | `#cc3a33` / `#b8302a` | Destructive buttons, error toasts. |
| `--danger-fg` | `#ffffff` | `#ffffff` | Text on danger. |
| `--danger-text` | `#b42318` | `#ff8b82` | Error sentences, invalid fields. |
| `--danger-soft` | `#fcebea` | `#2b1718` | A deletion's confirmation, a list that failed to load. |
| `--warning-text` | `#8a4a00` | `#f0b45e` | Hints that warn of a consequence (`.hint[data-tone="warning"]`): amber, not red, because nothing is wrong yet. |

**Above the page and the brand:** `--backdrop` (behind dialogs); `--toast` and
`--toast-fg`, inverted (a dark toast on a light page, a light one on a dark
page); `--shadow-color`, from which `--shadow-1` to `--shadow-3` are made;
`--glow-red`, `--glow-yellow`, `--glow-green`, the logo's bands as a faint
light over the top of each page (about a third opaque in light, under a tenth
in dark), gone by 480 px so that ballots and results sit on plain surfaces;
`--logo-frame-start`, `--logo-frame-end`, `--logo-paper-start`,
`--logo-paper-end`, the mark's frame and paper.

**The statistics** (`src/statistics`): `--map-land`, the land, on the
panel's surface as the sea; `--map-ink`, the dots and bars, a little lighter
in dark. No country is drawn, only land and a dot per time zone.

**Mentions** (`mentions.css`): whatever shows one carries `data-mention` (the
ballots) or `data-judgment` (the results) and paints with `--mention`,
writing on it with `--mention-fg`. The grey palette, `body[data-colorblind]`,
is seven greys evenly spaced in lightness, lighter is better.

## Appearance and themes

Two independent axes:

- **Appearance**, light or dark: `Preferences.appearance`, `system` (the
  default), `light` or `dark`, chosen in Settings. `system` needs no script:
  `:root { color-scheme: light dark }` lets the browser follow the device,
  and every `light-dark()` with it. A chosen appearance puts
  `data-appearance` on `<html>`, whose only rule is to force `color-scheme`.
  An inline script in `index.html` sets it before the first paint, because
  the bundle can arrive after the page is drawn: with the bundle held back two
  seconds, a page set to dark first painted light without that script, and
  dark with it.
- **Theme**, a palette: a block that redefines tokens under
  `:root[data-theme="<name>"]`. The default theme is the bare `:root`. There
  is one theme today, so nothing sets `data-theme` yet.

Because each token holds both schemes, a theme is one block, and themes and
appearances combine freely, with no dark block to keep in step.

**What the build does with `light-dark()`.** Vite 8 builds for its
`baseline-widely-available` target (Chrome 111, Firefox 114, Safari and iOS
16.4) and minifies CSS with Lightning CSS, which lowers `light-dark()` for
those browsers (it arrived in Chrome 123, Firefox 120, Safari 17.5). Each
`light-dark(a, b)` becomes `var(--lightningcss-light, a)
var(--lightningcss-dark, b)`, and every rule that sets `color-scheme` (`:root`,
its `prefers-color-scheme: dark` twin, each `[data-appearance]`) also sets
those two switches. The built bundle holds no `light-dark()` at all, so Safari
and iOS 16.4 get the right colours. The development server serves `light-dark()` as
written, for current browsers only. Checked in the built bundle by computed
colours: device light and dark, appearance system, light and dark, mentions in
colour and in grey.

Two rules follow from the lowering, which resolves tokens on the element that
declares them, `:root`:

- **Set `color-scheme` on `:root` only.** A subtree with a `color-scheme` of
  its own would switch in development and not in the build.
- **Apply a theme to `<html>` only.** Tokens made from other tokens
  (`--shadow-1` from `--shadow-color`) follow a theme only there.

### Adding a theme

1. **Palette.** In `style.css`, after the default tokens, add
   `:root[data-theme="<name>"] { ... }` redefining the tokens the theme
   changes, each with `light-dark()`: usually the surfaces, text, lines, ink
   and glow. Leave the mentions alone, and keep the ink away from red, yellow
   and green.
2. **Contrast.** Keep every pair in the table below at 4.5:1 (3:1 for the
   non-text pairs), in both schemes.
3. **Preference.** In `preferences.tsx`, add `theme: 'default' | '<name>'` to
   `Preferences` and `DEFAULTS`; `applyPreferences` sets
   `document.documentElement.dataset.theme`, and deletes it for the default.
   Read an unknown stored name as the default: development browsers still
   hold `theme: 'light' | 'dark'` from before appearance had its own name.
4. **First paint.** Set `data-theme` the same way in `index.html`'s inline
   script, so that a chosen theme never flashes the default.
5. **Browser bars.** If the theme changes `--bg`, give its two `theme-color`
   values: a map in `preferences.tsx` from theme to its light and dark colours,
   which `applyPreferences` writes into the metas' `content` (their `media`
   already follows the appearance).
6. **Picker.** In `SettingsMenu.tsx`, under Appearance, a `SegmentedControl`
   with the legend "Theme", `name="theme"` and one option per theme. Past three
   themes, a list of radio buttons with a swatch each: a phone fits three
   segments.
7. **Tests.** `preferences.test.tsx` (applied, remembered, unknown names fall
   back) and `App.test.tsx` (the picker changes it).
8. **Check the build**, not only the development server: `npm run build`,
   `npx vite preview`, then both schemes, both forced appearances and the grey
   mentions.

The architecture was proven on 2026-10-10 with a throwaway violet theme, in
development and in the build, under every appearance, then removed.

## Typography

System fonts only: `--font` (system-ui first) and `--font-mono` (join codes,
links to copy). Nothing to download, and native rendering in every script.

| Use | Size | Weight |
|---|---|---|
| Home hero | 32 to 44 px, `clamp(32px, 9vw, 44px)`, line height 1.1, −0.03 em | 700 |
| Page title, `h1` | 24 to 32 px, `clamp(24px, 6.2vw, 32px)`, −0.02 em | 700 |
| Section title, `h2` | 18 px; 20 px in dialogs | 600 |
| Body and inputs | 16 px, line height 1.5; never smaller in a field (iOS zooms) | 400 |
| Hints, meta, counts | 14 px | 400; statuses 600 |
| Scale legend, Live | 13 px | 600 |
| Badges; mention names on the scale | 12 px; the names 10 to 12 px with the scale's width (`cqi`), so "Inadequate" always fits its step | 600 |
| Join code | 34 to 48 px, mono, +0.08 em | 700 |
| Wordmark | 21 px, −0.03 em | 750 |

Three weights, 400, 600 and 700, and the wordmark's 750 (fonts without it
round to 700 or 800). Live numbers use tabular figures; headings balance their
lines.

## Space, shape and elevation

- **Spacing** follows a 4 px grid: 4, 8, 12, 16, 20, 24, 32. Sections of a
  page are 16 px apart on phones and 20 px wider; fields of a form 24 px;
  things inside a panel 8 to 16 px.
- **Radii**: `--radius-large`, 16 px, for panels and the ballot; `--radius`,
  12 px, for controls, inner cards, tracks and toasts; `--radius-small`, 8 px,
  for mention swatches and segments (12 px of track minus its 4 px of padding:
  corners stay concentric); 20 px for dialogs; pills for badges, Live and
  names; circles for icon buttons and ranks.
- **Elevation**, four levels: flat (callouts, the development tool);
  `--shadow-1` (panels, primary and danger buttons); `--shadow-2` (the
  ballot); `--shadow-3` (dialogs, toasts). Dark pages show elevation with
  lighter surfaces, `--surface` then `--surface-raised`: shadows hardly show
  on them.

## Layout

- One column of at most `--page-width` (760 px), centred, inside `--gutter`
  (16 px, 24 px from 640 px) and the safe-area insets.
- One breakpoint, 640 px. Below it dialogs are sheets from the bottom; from
  it they are centred, panels get 24 px of padding (`--panel-padding`), and a
  ballot row puts its option beside its scale.
- What depends on its own width uses container queries: the majority
  judgment scale names its steps from 480 px of scale; the results cards
  adapt below 400 and 360 px.
- The header is sticky, `--header-height` (56 px) plus the top inset, and
  translucent over a blur: back on the left (not on Home), the brand in the
  middle, Settings on the right. Toasts sit just under it.
- A poll's page: its title on the page itself (not in a card), any callout,
  the ballot, the invitations (the creator's), the results, when the poll will
  be deleted, the creator's actions, and in development the ballot feeder.

## Components

| Component | Classes | Notes |
|---|---|---|
| Panel | `.panel`; `.callout` (ink-tinted, flat), `.notice` (a page-sized message), `.panel.error-text`, `.dev-tool` (dashed) | `--surface`, hairline, `--shadow-1` |
| Buttons | `.button` with `.primary`, `.secondary`, `.danger`, `.link`, `.wide`; `.button-row`; `.icon-button` (`.icon-button-placeholder` keeps a slot) | at least `--tap` (44 px) high or wide |
| Fields | `input`, `select`, `.field`, `.field-problem`, `.hint`, `.hint[data-tone="warning"]` | `--field`, `--border-strong`, 16 px text |
| Segmented control | `.segmented`, `.segmented-options`, `.segmented-option` | radios: arrow keys work |
| Header | `.app-header`, `.app-header-inner`, `.brand`, `.logo` | |
| Home | `.hero`, `.join-form`, `.join-row`, `.join-code`, `.poll-list`, `.poll-list-item` | list rows run to the panel's edges |
| Ballot | `.ballot`, `.ballot-body`, `.ballot-status[data-counted]` | the raised sheet |
| Majority judgment ballot (`mj-ballot.css`) | `.mj-scale-legend`, `.mj-ballot-row`, `.mj-ballot-chosen[data-mention]`, `.mj-scale`, `.mj-scale-step`, `.mj-scale-mark`, `.mj-scale-name`; `.mj-dropdown-row select[data-mention]` | rows are lines on the sheet |
| Approval (`approval.css`) | `.approval-choice`, `.approval-result[data-winner]`, `.approval-rank`, `.approval-bar` | ink, not green |
| Results | `.results`, `.results-count`, `.live-status[data-state]`, `.voter-names`, `.name-cloud` | the graph itself is protected |
| Confirmation | `.confirm`, tinted red when it deletes (`:has(.button.danger)`) | |
| Invitations | `.invitation[data-used]`, `.invitation-status`, `.invite-form` | |
| Dialog | `.dialog`, `.dialog-body`, `.dialog-header`; `.share-code`, `.share-link`, `.share-qr` (white in every theme: QR codes need it) | |
| Toasts | `.toasts`, `.toast`, `.toast[data-kind="error"]` | under the header |
| Badge | `.badge` | neutral pill |
| Statistics (`statistics.css`) | `.statistics-totals`, `.statistics-panel`, `.world-map`, `.world-map-view`, `.world-map-land`, `.world-map-dot`, `.world-map-chosen`, `.world-map-legend`, `.world-map-zoom`, `.statistics-chosen`, `.activity-chart`, `.places-table` | the map runs to the panel's edges; a dot's area is its count, and dots keep their size on screen when zoomed; the chosen dot gets a 2 px `--fg` ring drawn on top, so nothing moves; the zoom buttons sit under the map, never over it |

States, the same everywhere:

- **Hover**: a background (`--surface-hover`, `--hover`, `--accent-hover`) or
  a border colour; links thicken their underline. Nothing changes size.
- **Focus**: `:focus-visible`, a 2 px `--focus` ring 2 px off the element. On
  fields it lies over the border (`outline-offset: -1px`), so they keep their
  size; on custom controls it goes on the visible part (the segment, the
  swatch, the approval row).
- **Chosen**: a mention swatch gets a 2 px `--fg` ring past a 2 px gap of the
  sheet, and a tick on phones or its name on wider scales, while the row's
  other swatches fade; an approval gets a 2 px ink edge (border and inset
  shadow), the soft ink ground and a tick; a segment lifts onto
  `--surface-raised`.
- **Disabled**: half opacity, the `not-allowed` cursor, no hover.
- **Error**: an `[aria-invalid]` field turns its border `--danger-text`, and
  a sentence follows it (`.field-problem`). Failures elsewhere are toasts.

Icons: the stroke icons of `ui/icons.tsx` take the text's colour; the tick and
the warning sign drawn in CSS are masks (`--icon-check`, `--icon-warning`),
painted in the colour of whatever shows them.

## Motion

Short, and only to explain a change: 120 ms for colours; 150 ms for swatches
fading and rings; 180 ms for a dialog (fades and rises), 220 ms for a sheet
(slides up); 200 ms for a toast (drops in); 300 ms for approval bars; 400 ms
for a name joining the cloud; the Live dot breathes every 2 s. Pressed
buttons shrink to 98 %. `prefers-reduced-motion` stops all of it (Base, in
`style.css`).

## Accessibility

Contrast as WCAG 2 ratios, light / dark. Each pair below is one the pages
actually show, found by measuring 4,040 texts on 16 screens (phone and
desktop, both schemes, both mention palettes), with translucent layers
composited:

| Text on | `--bg` | `--surface` | `--surface-raised` | `--surface-sunken` | `--card` | `--accent-soft` | `--danger-soft` | `--accent` | `--danger` | `--toast` |
|---|---|---|---|---|---|---|---|---|---|---|
| `--fg` | 16.4 / 16.3 | 17.9 / 15.0 | 17.9 / 13.6 | 15.7 / 16.0 | 17.9 / 14.2 | 15.4 / 13.7 | 15.5 / 14.6 | | | |
| `--muted` | 5.7 / 8.0 | 6.2 / 7.4 | 6.2 / 6.7 | 5.4 / 7.9 | 6.2 / 7.0 | | | | | |
| `--accent-text` | 6.4 / 9.1 | 7.0 / 8.4 | 7.0 / 7.6 | | | 6.0 / 7.6 | | | | |
| `--danger-text` | | 6.6 / 7.7 | 6.6 / 7.0 | | | | 5.7 / 7.5 | | | |
| `--warning-text` | | 6.9 / 9.5 | | | | | | | | |
| `--accent-fg` | | | | | | | | 7.0 / 5.1 | | |
| `--danger-fg` | | | | | | | | | 5.6 / 5.0 | |
| `--toast-fg` | | | | | | | | | | 15.0 / 15.4 |

- The glow, at its strongest (under the header), lowers light `--muted` to
  4.6 and `--accent-text` to 5.2: still AA.
- Non-text, at least 3:1: control edges (`--border-strong`) 3.4 to 3.9 in
  light, 3.6 to 4.3 in dark; the focus ring 6.1 to 7.0 and 7.6 to 8.9; a
  chosen mention's ring 17.9 and 13.6; ticks and bars (`--accent`) 6.0 to 7.0
  and 3.1 to 3.6.
- Colour is never the only sign: warnings carry an icon, a chosen mention is
  named and ringed, a counted ballot says so beside a tick, a used invitation
  says "Used".
- Tap targets of at least 44 px, 16 px text in fields, nothing that needs
  hovering. Where `:has()` is missing (Firefox before 121), a rated row keeps
  all its colours: the ring still marks the choice.
- Fixed on 2026-10-11, with the owner's leave, without changing a colour
  the owner chose: "Inadequate" is written in near-black on its `#ef4444`
  (5.2:1; white was 3.8:1); the medals' digits are dark on the metal (9.6,
  9.1 and 5.4:1 at their centre; light ones fell to 1.1:1); the rank badges
  past the third are `--fg` on `--bg`, so they show in dark too; the ex aequo
  chip is neutral (`--muted` on `--surface-sunken`) instead of pink and
  green, which read as mentions. Beta testers will tell whether they work.

## Copy

- Short, plain sentences, for people. *Poll* is the question, *ballot* one
  voter's answer; never "vote" as a noun. Mentions are spelled as
  `MENTION_NAMES` spells them.
- Buttons say what happens, and a confirmation names both ways out: "Delete
  for good" or "Keep it".
- A warning says the consequence: "Careful: everyone sees the results move as
  each ballot arrives."
- The server's error `detail` is shown as is: it is written for people.

## Protected

Changed only when the owner asks:

- **The results graph**, `MajorityJudgmentResultsGraph.tsx` and
  `majority-judgment.css`, the owner's reference (revised at his request on
  2026-09-24). It reads four tokens, `--card`, `--border`, `--muted` and
  `--fg`, whose values may change under it (and since 2026-10-11 the rank
  badges and the ex aequo chip read `--fg`, `--bg`, `--surface-sunken` and
  `--muted` too); its own colours (medals, score, tooltip) stay as they are.
- **The ranking**: `ranked.ts` renders the server's ranking, and never
  recomputes it.
- **The mention colours** and the grey palette, `mentions.css`, defined once
  for the ballots and the results.
- **Privacy rules that look like design**: a counted ballot starts hidden;
  results kept back show nothing to anyone; names stay an alphabetical cloud,
  every name the same size; options stay in the poll's order.
- Toasts stay at the top (at the bottom they covered the delete confirmation
  on phones), and dialogs hold their content only while open.
