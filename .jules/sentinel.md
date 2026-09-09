## 2024-05-15 - [CRITICAL] Hardcoded API Keys in Search Service
**Vulnerability:** A hardcoded `TAVILY_API_KEY` was found in `src/lib/tavily-search.ts`, exposing the dev key to potential leaks if the code is made public or improperly shared.
**Learning:** Hardcoded fallback credentials (e.g. `process.env.API_KEY || "key"`) are a severe risk. They get checked into version control and remain there forever, leading to potential unauthorized access and quota abuse.
**Prevention:** Never use hardcoded strings for fallback credentials. If an environment variable is essential but missing, the application should throw a clear error or handle the missing key safely (e.g., skip feature) rather than falling back to a hardcoded key. All secrets must be securely managed via `.env` files or secure secret managers.

### LLM Chat Component Integration
- When building chat stream consumers manually against standard Text Streams vs `ai` custom stream formats, ensure the response headers properly reflect simple `text/plain` vs `application/x-ndjson`.
- No hardcoded API keys were exposed in `etf-chat.tsx` or `route.ts`. API keys were correctly kept in `.env.local` which is `.gitignore`d.
