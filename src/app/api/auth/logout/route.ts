import { NextResponse } from 'next/server';
import { WORKSPACE_SESSION_COOKIE } from '@/lib/auth/passcode';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(WORKSPACE_SESSION_COOKIE);
  return response;
}

