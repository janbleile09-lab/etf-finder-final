## 2026-10-25 - Localization of Accessibility Labels
**Learning:** The application's UI and accessibility labels utilize German text. ARIA labels on icon-only buttons must match this language context to ensure a consistent experience for screen reader users.
**Action:** Always verify the application's primary language context and match any newly added text, tooltips, or ARIA labels to that language.

## 2026-10-26 - Keyboard Focus Indicators for Custom Interactive Elements
**Learning:** Custom interactive elements (like framer-motion spans or unstyled buttons) often lack default focus rings, creating an accessibility issue for keyboard users.
**Action:** Ensure all interactive elements include clear focus indicators by default, for example by adding `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` classes.
## 2026-11-01 - ARIA Accessibility for Custom Disclosures and Inputs
**Learning:** Custom disclosure patterns (like expandable panels toggled via `onClick`) require explicit ARIA attributes (`aria-expanded`, `aria-controls`, `id`, `role="region"`, and `aria-labelledby`) to be correctly interpreted by screen readers. Inputs also must have `aria-label` attributes that reflect their visual placeholders when no explicit `<label>` tag is present.
**Action:** Always ensure that custom interactive components built with `div` or `button` triggers paired with expandable regions include the appropriate ARIA attributes for robust accessibility. When adding inputs without visible labels, prioritize adding an `aria-label` matching the placeholder content.
