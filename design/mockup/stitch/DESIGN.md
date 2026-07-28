---
name: Nexora Financial Desktop
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444654'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2b50d8'
  primary: '#0e3ec7'
  on-primary: '#ffffff'
  primary-container: '#3559e0'
  on-primary-container: '#e0e3ff'
  inverse-primary: '#b8c3ff'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#005479'
  on-tertiary: '#ffffff'
  tertiary-container: '#006d9c'
  on-tertiary-container: '#cee9ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001355'
  on-primary-fixed-variant: '#0036bc'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  nav-width: 280px
  nav-width-collapsed: 80px
  gutter: 24px
  margin-page: 32px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style
The design system for desktop centers on a **Corporate / Modern** aesthetic that emphasizes clarity, efficiency, and high-density data management. The brand personality is authoritative yet accessible, designed to instill confidence in financial decision-making. 

The visual style utilizes a "Clean-Layering" approach: high-utility interfaces with generous whitespace to prevent cognitive overload during complex tasks. It moves away from the simplified mobile stack toward a sophisticated, multi-pane desktop experience. The environment is professional and grounded, favoring structural integrity and systematic alignment over decorative elements.

## Colors
The palette is anchored by **Nexora Blue**, a vibrant yet stable primary color used for key actions and brand presence. 

- **Primary (#3559E0):** Used for primary buttons, active states, and focus indicators.
- **Secondary (#1E293B):** Reserved for side navigation backgrounds and high-level headings to provide a strong visual anchor.
- **Tertiary (#0EA5E9):** An accent for data visualization, trends, and secondary highlights.
- **Surface Palette:** Utilizes a scale of cool greys (Slate) to define different functional zones. `Slate-50` is the global background, while `White` is used for content cards and data tables to create "islands of information."

## Typography
This design system utilizes **Inter** for all UI elements to ensure maximum legibility and a systematic, utilitarian feel. For desktop, the scale is expanded to handle complex information hierarchies.

- **Display & Headlines:** Used for dashboard summaries and page titles. Large sizes use tighter letter spacing to maintain visual tension.
- **Body Text:** `body-md` (14px) is the workhorse for data tables and form labels to maximize information density. `body-lg` (16px) is reserved for reading-heavy settings or introductory text.
- **Monospaced Utility:** JetBrains Mono is introduced as a secondary utility font for transaction IDs, account numbers, and currency values to ensure character alignment in tables.

## Layout & Spacing
The layout follows a **Fixed-Fluid hybrid** model. The sidebar remains fixed, while the content area fluidly expands up to a maximum width of 1440px to prevent excessive line lengths.

- **Grid System:** A 12-column grid is used for the main content area. Multi-column layouts are preferred, typically splitting the screen into a 8-column main view and a 4-column contextual "Action or Detail" pane.
- **Side Navigation:** A persistent 280px left-hand navigation is the primary way-finding tool. It can be collapsed to 80px (icon-only) to prioritize data workspace.
- **Persistent Header:** A 64px tall header stays pinned to the top of the content area (not the sidebar), containing breadcrumbs, global search, and profile settings.
- **Data Tables:** Use a 48px row height for standard density and 40px for "Compact View" settings.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows, maintaining a professional, flat aesthetic.

- **Level 0 (Background):** `Slate-50` provides the canvas.
- **Level 1 (Cards/Surface):** White surfaces with a 1px border (`Slate-200`) to define boundaries. No shadow is used here to keep the UI "light."
- **Level 2 (Dropdowns/Modals):** Floating elements use a subtle ambient shadow (0px 4px 20px rgba(0, 0, 0, 0.08)) to lift them off the base layer.
- **Sidebar Depth:** The secondary-colored sidebar uses a solid fill to create a distinct vertical plane, visually separating navigation from the workspace.

## Shapes
The design system adheres to a **8px (0.5rem)** base radius for standard components, providing a balanced look that is modern but not overly casual.

- **Standard Components:** Buttons, input fields, and cards all share the 8px radius.
- **Large Components:** Modals and large dashboard containers use `rounded-lg` (16px) to soften the large screen real estate.
- **Small Components:** Checkboxes and tags use `rounded-sm` (4px) to maintain sharpness at small scales.

## Components
- **Buttons:** Primary buttons are solid Nexora Blue. Secondary buttons use a ghost style with a 1px border. Desktop buttons feature a 40px height for standard actions.
- **Side Navigation:** Items feature a subtle hover state (background opacity 10%) and a 4px vertical "active" bar on the left edge.
- **Data Tables:** Headers are `Slate-100` with uppercase `label-md` text. Rows feature a subtle `Slate-50` hover effect. Columns with numerical data must be right-aligned.
- **Input Fields:** Use a 1px border that thickens to 2px in Nexora Blue on focus. Labels are positioned above the field for clarity in multi-column forms.
- **Cards:** Dashboard cards should have a consistent 24px internal padding. Title areas within cards are separated by a subtle 1px horizontal divider.
- **Persistent Stats Bar:** A horizontal row of "Metric Cards" (Value + Trend Indicator) should sit at the top of main dashboard views for immediate financial overview.