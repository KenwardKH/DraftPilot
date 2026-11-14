import { NextRequest, NextResponse } from 'next/server';
import { isPasscodeConfigured, isRequestAuthorized } from '@/lib/auth/passcode';

export async function GET(req: NextRequest) {
  const configured = isPasscodeConfigured();
  const authorized = isRequestAuthorized(req);

  return NextResponse.json({
    required: configured,
    authenticated: !configured || authorized,
  });
}
