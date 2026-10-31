## 2024-10-24 - Pre-compute Search Strings to Prevent Inline Allocations

**Learning:** Doing string manipulations like `.toLowerCase()` across multiple fields inside a React `.filter()` loop on every keystroke causes a noticeable performance bottleneck due to excessive string allocations on the main thread (O(N*3) per keypress).

**Action:** When filtering static or mostly-static large lists in React components, pre-compute a combined lowercase search string at the module scope outside the component, reducing the filter step to a single, much faster `.includes()` lookup.
## 2024-10-26 - useDeferredValue for Heavy Search Filtering
**Learning:** Even with pre-computed search strings, filtering a large dataset inline on every keystroke can block the main thread in React, causing perceived lag during typing.
**Action:** Use `useDeferredValue` for input search states when filtering large lists. This allows the input to update immediately for responsiveness, while the expensive filtering operation yields to the background, running only when the main thread is unblocked.

## 2026-10-31 - Extract ReactMarkdown into React.memo component
**Learning:** When using heavy libraries like ReactMarkdown inside a map loop, and a parent component holds frequently updated state (like an input field), the entire list re-renders on every keystroke, causing severe lag.
**Action:** Extract the expensive list item (with ReactMarkdown and regexes) into a separate component wrapped in React.memo() to prevent O(N) re-renders.
