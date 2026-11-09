## 2024-10-24 - Pre-compute Search Strings to Prevent Inline Allocations

**Learning:** Doing string manipulations like `.toLowerCase()` across multiple fields inside a React `.filter()` loop on every keystroke causes a noticeable performance bottleneck due to excessive string allocations on the main thread (O(N*3) per keypress).

**Action:** When filtering static or mostly-static large lists in React components, pre-compute a combined lowercase search string at the module scope outside the component, reducing the filter step to a single, much faster `.includes()` lookup.
## 2024-10-26 - useDeferredValue for Heavy Search Filtering
**Learning:** Even with pre-computed search strings, filtering a large dataset inline on every keystroke can block the main thread in React, causing perceived lag during typing.
**Action:** Use `useDeferredValue` for input search states when filtering large lists. This allows the input to update immediately for responsiveness, while the expensive filtering operation yields to the background, running only when the main thread is unblocked.
## 2024-11-08 - Extract Expensive Render Logic from Chat Input State
**Learning:** Having an expensive inline mapping of custom components, complex operations like parsing text with ReactMarkdown, or running multiple regex searches in the same component tree that frequently updates via keystrokes (like typing in a chat input field) forces major UI stutter due to severe O(N) re-renders, causing noticeable input latency.

**Action:** Always extract expensive inline operations and heavy mapping functionality into separate components, and wrap them in `React.memo()`. Derive complex mapped references locally in the child via `useMemo()` instead of passing them into the child as a prop, as passing inline arrays from maps causes reference instability that breaks shallow equality checks.
## 2024-05-18 - Concurrent API Requests
**Learning:** Sequential network requests in loops heavily block execution time.
**Action:** Replaced a sequential `for` loop of API requests with `Promise.all` and concurrent `Array.map` to perform requests in parallel, cutting elapsed time by up to ~3x (1500ms -> 500ms).

## 2025-01-20 - Memoizing Chat Message Components
**Learning:** Inline component rendering within large lists or frequently updating components causes significant re-renders, especially with expensive operations like Markdown parsing.
**Action:** Extract list item rendering logic into separate components and wrap them in React.memo() to prevent unnecessary O(N) re-renders during state updates like typing in an input field.
