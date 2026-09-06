## 2024-05-24 - Remove Hardcoded API Key
**Vulnerability:** A hardcoded API key for Tavily Search was found as a fallback in `src/lib/tavily-search.ts` (`const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "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";`).
**Learning:** Hardcoded API keys in source code can be easily extracted by attackers, leading to unauthorized access, quotas exhaustion, and potential financial loss. It was likely left in as a convenience during development.
**Prevention:** Never commit API keys or secrets to source control. Always rely on environment variables (`process.env.XXX`) for configuration. Add linting rules (like `eslint-plugin-no-secrets`) or use tools like `git-secrets` or `trufflehog` to scan for secrets before committing.
