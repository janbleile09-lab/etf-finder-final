# ETF Finder

Discover and compare ETFs with a clean, minimal interface.

Built with [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), and [Supabase](https://supabase.com).

## Getting Started

```bash
npm install
npm run dev     # starts on http://localhost:3001
```

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NVIDIA_API_KEY=your-nvidia-api-key       # optional, for AI chat
TAVILY_API_KEY=your-tavily-api-key       # optional, for ETF enrichment
TWELVE_DATA_API_KEY=your-twelve-data-key # optional, for market data
```

## Deploy on Netlify

1. Push to a Git repository
2. Connect the repo to Netlify
3. Set the environment variables above in Netlify's site settings
4. Deploy — Netlify auto-detects Next.js and uses the `netlify.toml` config

Build command: `npm run build`
Publish directory: `.next`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Netlify + Next.js](https://docs.netlify.com/frameworks/next-js/overview/)
