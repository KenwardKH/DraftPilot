import { NextRequest, NextResponse } from 'next/server';
import {
  PasscodeRequestSchema,
  verifyCandidatePasscode,
  getPasscodeSessionToken,
  WORKSPACE_SESSION_COOKIE,
} from '@/lib/auth/passcode';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PasscodeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Passcode is required' },
        { status: 400 }
      );
    }

    const isValid = verifyCandidatePasscode(parsed.data.passcode);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PASSCODE' },
        { status: 401 }
      );
    }

    const token = getPasscodeSessionToken();
    const response = NextResponse.json({
      success: true,
      token,
    });

    response.cookies.set({
      name: WORKSPACE_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err) {
    console.error('Passcode verification error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
