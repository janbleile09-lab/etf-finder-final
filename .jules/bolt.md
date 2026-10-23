
## 2025-02-18 - Avoid O(N) operations per keystroke in search filters
**Learning:** In React components with client-side text filtering over a large static dataset (like `etfs.json` containing 600 items), computing `toLowerCase` on multiple string fields for *every* item on *every* keystroke generates thousands of strings and blocks the main thread.
**Action:** When filtering static arrays based on user input, pre-compute a concatenated, lowercase `searchStr` once at module level. Filter against this pre-computed string during keystrokes rather than recomputing the properties.
