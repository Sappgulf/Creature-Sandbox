# Accessibility Notes

## Supported Features
- **Keyboard navigation:** Focusable controls in HUD, panels, and dialogs.
- **Visible focus styles:** `:focus-visible` rings for keyboard users.
- **Reduced motion:** Toggle in the Features panel (defaults to OS preference and persists).
- **Screen-reader labels:** Icon-only buttons include `aria-label` text where appropriate.
- **In-menu help:** The overflow menu includes a Help section that documents controls and shortcuts.
- **Touch target sizing:** Mobile HUD buttons and panel close controls aim for ~44px targets.

## Known Limitations
- **Canvas rendering:** Creature visuals, heatmaps, and world state on the canvas are not exposed to screen readers.
- **Drag/gesture-only actions:** Some interactions (pan/zoom, pinch) require touch or mouse input.
- **Charts and mini-maps:** Canvas-based charts are not currently accessible to assistive technology.

## Quick Manual Test Steps
1. **Keyboard:** Tab through HUD buttons and panel controls; ensure focus rings are visible.
2. **Reduced motion:** Toggle Reduced Motion and confirm animations are minimized.
3. **Labels:** Verify icon buttons announce meaningful labels with a screen reader.
4. **Mobile touch:** Confirm tap targets are comfortably sized and panels remain visible with the keyboard open.
5. **Help content:** Open the ⋯ menu and ensure the Help section is readable via keyboard focus.
