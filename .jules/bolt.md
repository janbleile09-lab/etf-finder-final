## 2024-10-24 - Pre-compute Search Strings to Prevent Inline Allocations

**Learning:** Doing string manipulations like `.toLowerCase()` across multiple fields inside a React `.filter()` loop on every keystroke causes a noticeable performance bottleneck due to excessive string allocations on the main thread (O(N*3) per keypress).

**Action:** When filtering static or mostly-static large lists in React components, pre-compute a combined lowercase search string at the module scope outside the component, reducing the filter step to a single, much faster `.includes()` lookup.

## 2026-10-27 - Prevent unmemoized O(N) calculations in render IIFEs
**Learning:** The Sparkline component redundantly recalculated min/max array bounds inside an IIFE during every render to draw the trailing dot, despite the same values being computed in a useMemo block just above it.
**Action:** Moved the dot coordinate calculations (cx, cy) into the existing useMemo block to prevent duplicate work and ensure O(N) array operations only run when data changes.
