import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const WORKSPACE_SESSION_COOKIE = 'workspace_session';
export const WORKSPACE_PASSCODE_HEADER = 'x-workspace-passcode';
export const WORKSPACE_TOKEN_HEADER = 'x-workspace-token';

async function sha256Hex(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

  // 1. Check direct passcode header
  const headerPasscode = req.headers.get(WORKSPACE_PASSCODE_HEADER)?.trim();
  if (headerPasscode && headerPasscode === passcode) {
    return NextResponse.next();
  }

  // 2. Check session token header or cookie
  const expectedToken = await sha256Hex(passcode);

  const headerToken = req.headers.get(WORKSPACE_TOKEN_HEADER)?.trim();
  if (headerToken && headerToken === expectedToken) {
    return NextResponse.next();
  }

  const cookieToken = req.cookies.get(WORKSPACE_SESSION_COOKIE)?.value?.trim();
  if (cookieToken && cookieToken === expectedToken) {
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
