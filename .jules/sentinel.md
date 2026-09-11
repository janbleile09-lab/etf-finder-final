## 2024-05-15 - [CRITICAL] Hardcoded API Keys in Search Service
**Vulnerability:** A hardcoded `TAVILY_API_KEY` was found in `src/lib/tavily-search.ts`, exposing the dev key to potential leaks if the code is made public or improperly shared.
**Learning:** Hardcoded fallback credentials (e.g. `process.env.API_KEY || "key"`) are a severe risk. They get checked into version control and remain there forever, leading to potential unauthorized access and quota abuse.
**Prevention:** Never use hardcoded strings for fallback credentials. If an environment variable is essential but missing, the application should throw a clear error or handle the missing key safely (e.g., skip feature) rather than falling back to a hardcoded key. All secrets must be securely managed via `.env` files or secure secret managers.
## 2024-05-15 - [HIGH] Open Redirection Vulnerability in Auth Callback
**Vulnerability:** The OAuth callback endpoint (`src/app/auth/callback/route.ts`) read the `next` parameter from the URL and blindly appended it to the origin when creating a redirect. An attacker could craft a malicious URL (e.g., `?next=//evil.com`) which would lead to an open redirection since `http://example.com//evil.com` may be interpreted as `http://evil.com/` due to protocol-relative resolution if the browser normalizes it or forwards the user off-site.
**Learning:** Never trust the `next` or `redirectTo` parameters supplied by a client. Always validate that they represent safe, relative paths within your application.
**Prevention:** Sanitize the return URL by ensuring it begins with a single forward slash (`/`) and does NOT begin with a double forward slash (`//`). This guarantees it stays a local, relative redirect.

## Avoiding Hardcoded API Keys
* **Issue:** Hardcoded API keys (e.g., `NVIDIA_API_KEY`) within source code files expose sensitive credentials if the code is shared, pushed to a public repository, or viewed by unauthorized individuals.
* **Resolution:** Ensure API keys are loaded via environment variables using `.env` files (e.g., `process.env.NVIDIA_API_KEY`) and that the `.env` file is excluded from version control via `.gitignore`.

## 2024-05-15 - [CRITICAL] Missing Authentication and Error Leakage in Chat API
**Vulnerability:** The `/api/chat` endpoint lacked authentication checks, allowing unauthorized access to the AI advisor feature. In addition, errors were logged and returned with `error.message`, which could leak sensitive internal information or stack trace details in the response body.
**Learning:** API routes that require user context or have usage costs must strictly verify authentication. Furthermore, error handling should never leak internal details to the client; raw errors should be logged server-side, but clients should only receive generic error messages.
**Prevention:** Always use `supabase.auth.getUser()` in protected API routes to verify authentication. Return generic error messages (e.g., "An internal error occurred") to the client, while keeping detailed error logs on the server.
