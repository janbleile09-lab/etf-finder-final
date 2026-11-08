## 2026-10-25 - Localization of Accessibility Labels
**Learning:** The application's UI and accessibility labels utilize German text. ARIA labels on icon-only buttons must match this language context to ensure a consistent experience for screen reader users.
**Action:** Always verify the application's primary language context and match any newly added text, tooltips, or ARIA labels to that language.

## 2026-10-26 - Keyboard Focus Indicators for Custom Interactive Elements
**Learning:** Custom interactive elements (like framer-motion spans or unstyled buttons) often lack default focus rings, creating an accessibility issue for keyboard users.
**Action:** Ensure all interactive elements include clear focus indicators by default, for example by adding `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` classes.

## 2026-10-27 - Unique IDs for ARIA in dynamic lists
**Learning:** Custom disclosure patterns within dynamic lists (like .map loops) must use globally unique IDs to prevent DOM ID collisions for aria-controls and aria-labelledby.
**Action:** Ensure generated id and aria-controls values utilize unique identifiers (such as indices or ISIN) when implementing custom interactive elements in dynamic lists.
