import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  let next = requestUrl.searchParams.get("next") ?? "/";

  // Sanitize 'next' to prevent open redirection
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/";
  }

  // Create the final response object first so we can attach cookies to it
  const response = NextResponse.redirect(`${requestUrl.origin}${next}`);

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Set the cookie on the response so the browser saves it
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Auth callback error:", error.message);
      return NextResponse.redirect(`${requestUrl.origin}/?authError=Authentication%20failed`);
    }
    
    return response;
  }

  // No code present
  return NextResponse.redirect(`${requestUrl.origin}/?authError=no_code`);
}
