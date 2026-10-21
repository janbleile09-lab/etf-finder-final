## 2023-10-21 - O(N²) Performance Bottleneck in Array Maps
**Learning:** Calculating global metric ranges (min/max over an array) inside a `.map()` callback function leads to an O(N²) time complexity. This was found in `scoreRisk` where it was doing `Math.min(...allEtfs.map(...))` on every iteration of `allEtfs.map` in `scoreCandidates`.
**Action:** Always pre-calculate global metrics or ranges outside of loops/maps and pass them in as an argument to avoid redundant calculations.
