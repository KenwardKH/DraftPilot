import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  WORKSPACE_SESSION_COOKIE,
  WORKSPACE_PASSCODE_HEADER,
  WORKSPACE_TOKEN_HEADER,
  sha256Hex,
  timingSafeEqualString,
} from '@/lib/auth/constants';

export async function middleware(req: NextRequest) {
  const passcode = process.env.WORKSPACE_PASSCODE?.trim();

  // If WORKSPACE_PASSCODE is not configured, allow all requests immediately
  if (!passcode) {
    return NextResponse.next();
  }

  // Exempt auth endpoints from passcode gate
  const pathname = req.nextUrl.pathname;
  if (
    pathname.startsWith('/api/auth/status') ||
    pathname.startsWith('/api/auth/verify') ||
    pathname.startsWith('/api/auth/logout')
  ) {
    return NextResponse.next();
  }

  // 1. Check direct passcode header with constant-time comparison
  const headerPasscode = req.headers.get(WORKSPACE_PASSCODE_HEADER)?.trim();
  if (headerPasscode && timingSafeEqualString(headerPasscode, passcode)) {
    return NextResponse.next();
  }

  // 2. Check session token header or cookie with constant-time comparison
  const expectedToken = await sha256Hex(passcode);

  const headerToken = req.headers.get(WORKSPACE_TOKEN_HEADER)?.trim();
  if (headerToken && timingSafeEqualString(headerToken, expectedToken)) {
    return NextResponse.next();
  }

  const cookieToken = req.cookies.get(WORKSPACE_SESSION_COOKIE)?.value?.trim();
  if (cookieToken && timingSafeEqualString(cookieToken, expectedToken)) {
    return NextResponse.next();
  }

  // Unauthorized - reject API access
  return NextResponse.json(
    { error: 'UNAUTHORIZED', passcodeRequired: true },
    { status: 401 }
  );
}

export const config = {
  matcher: ['/api/:path*'],
};

