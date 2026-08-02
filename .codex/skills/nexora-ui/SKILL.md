---
name: nexora-ui
description: Implement or review Nexora React UI, App Shell, responsive layouts, forms and accessibility against the official Stitch mockup while preserving approved colors and fonts. Use for UI layout, components, pages, dialogs and visual regressions.
---

# Nexora UI

1. Route the task, then read the relevant row in `docs/ux/MOCKUP_INTEGRATION.md` and the official
   Stitch design reference only for the affected surface.
2. Preserve Nexora colors, fonts, financial invariants and real view models; never copy Stitch app
   logic or use the legacy mockup.
3. Reuse shared tokens and components before adding feature CSS.
4. Verify keyboard path, names, focus, error messaging and WCAG 2.2 AA basics.
5. Test the affected component and required viewports; reserve the full visual matrix for phase gates.

Never replace persistence with mocks to make a page render.
