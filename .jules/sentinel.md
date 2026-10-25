## Security Learnings & Notes (Sentinel)
- Removed unused local variables and replaced implicit `any` with explicitly typed objects (e.g. `{ symbol: string; exchange: string }`).
## 2025-02-27 - Security Hardening of LLM Endpoints
**Vulnerability:** The API handler in `src/app/api/chat/route.ts` did not limit the length of the `messages` array, the length of individual messages, or the allowed message roles (allowing arbitrary `system` messages).
**Learning:** LLM endpoints that process external message arrays are susceptible to Resource Exhaustion/Denial of Service (DoS) and Prompt Injection attacks if payload sizes and message roles are unconstrained.
**Prevention:** Implement array size bounds (e.g. `messages.length > 50`), filter out unauthorized roles (only allow `user` and `assistant`), and defensively truncate input text before passing it to AI SDK generation functions.
