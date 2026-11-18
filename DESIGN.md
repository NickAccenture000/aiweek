# Design

World: air traffic **flight strips** and **aeronautical charts**, held to type, palette, density and one signature move. Navigation and controls stay standard.

## Type
One family: **Atkinson Hyperlegible Next** (variable, OFL, self-hosted in `assets/fonts/`). Chosen for legibility in safety-critical reading: disambiguated glyphs (I / l / 1, 0 / O) matter for incident IDs, times and system names. Tabular, lining numerals on every figure.
Scale about 1.125: 12 / 13 / 15 / 17 / 19 / 22 / 26. Body 15, labels 12–13 uppercase with tracking only for column and group headings.

## Colour
- **Shell (second neutral):** midnight ink `#10172b`, with `#19223f` and `#27325a` for hover and active.
- **Ground:** cool paper `#eceff4`; content surface white.
- **Accent:** chart blue `#2646d0`, used for primary actions, selection and the current step only.
- **State:** red `#bd2418` unavailable / major, amber `#8a5300` degraded / needs attention, green `#0a7945` operational / confirmed. Never decorative.

## Signature move
The incident list is a column of **flight strips**: a filled severity cell (MAJOR / MINOR) at the left, then ID and time, title, and state. Delivery is shown as a row of **strip pips**, one per recipient, filling from grey to blue (delivered) to green (confirmed).

## Components
Standard controls only: buttons (primary, secondary, ghost, danger), tabs-style stepper, tables, switches, selects, checkboxes, banners. One icon set drawn in a 1.75 stroke on a 24px grid. Radii 6px for controls, 10px for surfaces. Motion 150–250 ms, only for state (hover, switch, pips); loading uses skeletons.

## Not used
Nested cards, coloured side borders, gradient text, emoji or glyphs as icons, display faces in UI.
