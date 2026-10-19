# Security Learnings

## Open Redirect in Next.js Auth Callback
- **Issue**: The `next` query parameter in the auth callback endpoint (`/auth/callback/route.ts`) was sanitized to prevent open redirection by ensuring the path started with `/` and did not start with `//`. However, this was insufficient because `/\` could also be parsed as an absolute protocol-relative URL by some environments, bypassing the check (e.g. `/\\evil.com` resolves to `http://evil.com`).
- **Fix**: The sanitization check was updated to explicitly block paths starting with `/\\` (the backslash character after the slash).
- **Prevention**: When implementing safe redirect validation for query parameters, ensure paths do not start with `//` or `/\\` and consider that both slashes and backslashes can be normalized as directory separators or protocol slashes in many contexts. Alternatively, use a robust regex like `/^\/(?!\/|\\)/`.
