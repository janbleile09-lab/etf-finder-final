## 2026-09-10 - [Sentinel: Added Input Length Limit to Prevent DoS]
**Vulnerability:** Missing input validation (length limits) in `/api/market-data` endpoint (Medium Priority). The endpoint accepted an arbitrarily large array of `etfs`.
**Learning:** This exposes the application to resource consumption Denial of Service (DoS) attacks, as processing a huge array could exhaust server resources (CPU, network, or external API limits via Twelve Data).
**Prevention:** Always implement array length checks (e.g., `if (etfs.length > 50)`) before processing arrays in API endpoints, returning 400 Bad Request to reject overly large payloads early.
