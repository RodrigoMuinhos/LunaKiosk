import { NextResponse } from 'next/server';

// Middleware intentionally disabled (restore original behavior: /system allowed).
// Kept as a no-op to avoid breaking builds that might reference this file.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/__never_match__'],
};
