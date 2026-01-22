# UI Navigation Condense Plan & Mapping

## Phase 0 — Current Top Menu Audit

Top HUD actions currently displayed (before refactor):

| Action | Frequency | Context | Risk if Hidden | Notes |
| --- | --- | --- | --- | --- |
| Pause/Resume (Space) | High | Global | High | Core loop control. |
| Single Step | Rare | Sandbox-only | Low | Debugging and inspection. |
| Campaign Mode | Medium | Global | Medium | Progression entry point. |
| Achievements | Medium | Global | Low | Progress tracking. |
| Scenario Lab | Medium | Editor-only | Medium | Scenario configuration. |
| Gene Editor | Medium | Editor-only | High | Creature creation pipeline. |
| Ecosystem Health | Medium | Sandbox-only | Low | Health diagnostics. |
| Features | Rare | Global | Low | Visualization toggles. |
| Analytics Dashboard | Medium | Sandbox-only | Medium | Data inspection. |
| Debug Console | Rare | Debug-only | Low | Dev-only diagnostics. |
| Performance Monitor | Rare | Debug-only | Low | Dev-only diagnostics. |

Duplicates/grouping opportunities:
- **Progress**: Campaign + Achievements
- **Tools**: Scenario Lab + Gene Editor + Features
- **Insights**: Analytics + Ecosystem Health
- **Developer**: Debug Console + Performance Monitor

## Phase 1 — Condensed Top Bar Structure

Primary HUD items (3 total):
1. **Modes & Goals** — toggles the Game Mode + Session Goals card.
2. **Pause/Resume** — primary simulation control (Space still works).
3. **Overflow (⋯)** — grouped menu for all other actions.

Overflow menu groups:
- **Simulation**: Single Step
- **Progress**: Campaign Mode, Achievements
- **Tools**: Scenario Lab, Gene Editor, Features
- **Insights**: Ecosystem Health, Analytics Dashboard
- **Developer**: Debug Console, Performance Monitor
- **Help**: Inline guidance for controls, shortcuts, and menu mapping

Mobile behavior:
- Overflow opens a **bottom sheet** with 44px+ tap targets and safe-area padding.

## Phase 2 — Action Mapping (Old → New)

| Action | New Location | Access Distance |
| --- | --- | --- |
| Pause/Resume | Primary HUD | 1 tap |
| Single Step | Overflow → Simulation | 2 taps |
| Campaign Mode | Overflow → Progress | 2 taps |
| Achievements | Overflow → Progress | 2 taps |
| Scenario Lab | Overflow → Tools | 2 taps |
| Gene Editor | Overflow → Tools | 2 taps |
| Ecosystem Health | Overflow → Insights | 2 taps |
| Features | Overflow → Tools | 2 taps |
| Analytics Dashboard | Overflow → Insights | 2 taps |
| Debug Console | Overflow → Developer | 2 taps |
| Performance Monitor | Overflow → Developer | 2 taps |

## Phase 3 — Contextuality & Accessibility

- **Contextual primary**: Pause/Resume reflects game state (play icon when paused).
- **Developer-only actions**: grouped under Developer; no changes to existing toggles.
- **Keyboard**: Overflow supports arrow keys, Enter, Escape.
- **Screen reader**: icon buttons retain `aria-label` and `aria-keyshortcuts` where available.
