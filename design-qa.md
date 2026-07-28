# Delay Bubble Design QA

- Source visual truth: `C:\Users\kj\.codex\codex-remote-attachments\019f9c9d-e77f-75a0-989a-ebd1b4e939d7\C85AAFE8-D85F-4351-A386-898AF5E4998A\1-写真1.jpg`
- Source dimensions: 374 x 439 px
- Desktop implementation screenshot: `C:\Users\kj\AppData\Local\Temp\train-live-map-delay-bubble.png`
- Desktop viewport and screenshot: 1681 x 1199 CSS px / 1681 x 1199 px / device pixel ratio 1
- Mobile implementation screenshot: `C:\Users\kj\AppData\Local\Temp\train-live-map-delay-bubble-mobile-full.png`
- Mobile viewport and screenshot: 390 x 844 CSS px / 390 x 844 px / device pixel ratio 1
- Density normalization: no scaling was required because implementation captures used device pixel ratio 1. The source was treated as a close-up component reference rather than a full-screen layout target.
- State: mock Tokaido Line data with 6 trains; 3 delayed, 2 on time, and 1 suspended

## Full-view comparison evidence

The source and both rendered implementation screenshots were opened together for visual comparison. The implementation preserves the source's core treatment: a compact rose-red pill above the train, bold white `+N分` text, a white outline, centered speech-bubble tail, and clear separation from the map.

The mobile capture confirms the bubble remains legible in the primary phone layout and moves with the marker. Desktop capture confirms the treatment does not dominate the wider map.

## Focused-region comparison evidence

A separate crop was not needed. The source is already a close-up of the target component, and the mobile full-view capture renders all three delay bubbles at a readable size. DOM geometry additionally confirmed every visible bubble is horizontally centered over its train icon and positioned above it.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the app uses its existing sans-serif stack, with an 11 px, extra-bold white label that matches the reference's compact emphasis.
- Spacing and layout rhythm: the bubble is centered directly above the 40 px marker, with compact horizontal padding and a small tail.
- Colors and visual tokens: rose `#e84462`, white text and border, and a dark drop shadow reproduce the reference's delay alert hierarchy while fitting the current map palette.
- Image quality and asset fidelity: the existing vector train marker remains sharp; the delay treatment adds no raster scaling or replacement assets.
- Copy and content: visible labels use `+1分`, `+3分`, and `+8分`; accessible marker names add `N分遅れ`.
- State behavior: only positive delays are shown. On-time trains hide the bubble, and suspended trains keep the suspension badge without a delay bubble.

## Interaction and runtime checks

- Primary interactions tested: open line selector, enable Tokaido Line, close selector, render delayed and non-delayed markers.
- Console errors and warnings checked: none.
- Automated checks: lint, 13 tests, and production build all passed.

## Comparison history

- Pass 1: no P0/P1/P2 visual findings. No visual fixes were required after the first rendered comparison.

final result: passed
