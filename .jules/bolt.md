## 2023-10-20 - [O(N²) Array Operations in Scoring]
**Learning:** React/Node.js arrays calling Math.min/Max using spread inside maps can create hidden O(N²) bottlenecks when nested in iteration passes (like `scoreCandidates` calling `scoreRisk` which iterated all candidates again to find extrema).
**Action:** Always precompute extrema (mins, maxes) of collections in a single O(N) pass outside of any loop mapping over that same collection, and pass the results into the mapping function as an arguments object.
