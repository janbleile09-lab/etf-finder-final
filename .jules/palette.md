## 2024-10-23 - Screen reader accessibility for temporary messages
**Learning:** Temporary notifications like toasts are frequently missed by screen readers if they lack proper ARIA live region attributes (`role="status"` and `aria-live="polite"`). Also, icon-only buttons (like the close 'X' in a toast) are inaccessible unless they have an `aria-label`.
**Action:** Always ensure temporary status messages use ARIA live regions and all icon-only interactive elements contain screen-reader friendly `aria-label` attributes.
