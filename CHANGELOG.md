# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Mobile spawn picker sheet with large tap targets and explicit spawn confirmation.
- Gene editor share codes (copy/import) and spawn-mode feedback.
- Nameplates toggle in Features panel.
- Reduced motion toggle (respects OS preference + stored setting).
- Accessibility status messaging for gene code actions.
- Overflow menu Help section with controls and shortcuts.
- Save/load hotkeys for file downloads (Ctrl/⌘ + S / Ctrl/⌘ + O).
- Dev-only FPS overlay and timing logs behind `?devtools=1`.
- Creature reactions to poke/drop/collision with subtle personality-driven animation.
- Hover/grab outlines and grab reaction feedback for direct creature manipulation.
- Session goal nudges for manual creature spawns.
- Success pulse + error shake feedback for gene editor status messages.
- Sandbox props: bounce pads, spinners, gravity wells, and food buttons.
- Creature grab/drag/throw interactions with throw feedback.
- Session goals for prop triggers and creature launches.
- Contextual sandbox action prompts.

### Changed
- Interaction hints now auto-dismiss, include a close button, and clear on mode/panel transitions.
- Panel max-heights now respect dynamic mobile viewport sizing.
- Mobile viewport handling now uses VisualViewport updates when available.
- Analytics dashboard now scales charts to fit the current viewport.
- Condensed top HUD into primary actions with an overflow menu and mobile sheet.
- Tuned mobile pan/zoom sensitivity and keyboard-safe panel padding.
- Throttled eco-health updates and reduced pointer move allocations.
- Selected creature panel now shows guidance when nothing is selected.
- Home screen copy now highlights playful sandbox tone.
- Selected creature outlines now glow and pulse on selection.
- Added soft creature bump reactions and sandbox prop rendering layer.

### Notes
- **WHAT:** Added hover/grab outlines and grab/drop reactions to clarify direct manipulation.
- **WHY:** Make interactable creatures feel obvious and responsive during drag/throw play.
- **RISK:** Low; visual-only feedback layered on existing input handling.
- **VERIFY:** `npm test`, `npm run lint`, and manual hover/drag checks.

### Notes (2026-01-28)
- **WHAT:** Added mobile spawn picker sheet and auto-dismissing, dismissible interaction hints.
- **WHY:** Fix mobile creature selection and prevent help text from lingering over gameplay.
- **RISK:** Low; UI-only changes with fallback to the last used spawn type.
- **VERIFY:** `npm test`, `npm run lint`, and mobile spawn selection smoke checks.

## [2026-01-21]
### Added
- Tool HUD indicator that shows active tool and brush size.
- Brush size hotkeys (`[` and `]`).
- Spawn button now remembers last creature type selection.
- Smoke test and roadmap documentation.
- Agent guidelines for future sessions.

### Changed
- Stats HUD styling to highlight tool status.
- Shortcuts overlay updated with brush size controls.
