import crypto from 'node:crypto';
import { z } from 'zod';
import {
  WORKSPACE_SESSION_COOKIE,
  WORKSPACE_PASSCODE_HEADER,
  WORKSPACE_TOKEN_HEADER,
  timingSafeEqualString,
} from './constants';

export {
  WORKSPACE_SESSION_COOKIE,
  WORKSPACE_PASSCODE_HEADER,
  WORKSPACE_TOKEN_HEADER,
};

export const PasscodeRequestSchema = z.object({
  passcode: z.string().min(1, 'Passcode cannot be empty'),
});

export function isPasscodeConfigured(): boolean {
  const code = process.env.WORKSPACE_PASSCODE;
  return Boolean(code && code.trim().length > 0);
}

export function getPasscodeSessionToken(): string {
  const code = process.env.WORKSPACE_PASSCODE?.trim() || '';
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function verifyCandidatePasscode(candidate?: string | null): boolean {
  if (!isPasscodeConfigured()) return true;
  if (!candidate) return false;

  const expected = process.env.WORKSPACE_PASSCODE!.trim();
  const candidateBuf = Buffer.from(candidate.trim());
  const expectedBuf = Buffer.from(expected);
  if (candidateBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

export function verifySessionToken(token?: string | null): boolean {
  if (!isPasscodeConfigured()) return true;
  if (!token) return false;

  const expectedToken = getPasscodeSessionToken();
  const tokenBuf = Buffer.from(token.trim());
  const expectedBuf = Buffer.from(expectedToken);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

export function isRequestAuthorized(request: Request): boolean {
  if (!isPasscodeConfigured()) return true;

  // 1. Check direct passcode header
  const headerPasscode = request.headers.get(WORKSPACE_PASSCODE_HEADER);
  if (headerPasscode && verifyCandidatePasscode(headerPasscode)) {
    return true;
  }

  // 2. Check token header
  const headerToken = request.headers.get(WORKSPACE_TOKEN_HEADER);
  if (headerToken && verifySessionToken(headerToken)) {
    return true;
  }

  // 3. Check cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${WORKSPACE_SESSION_COOKIE}=([^;]*)`));
  if (match && match[1]) {
    const cookieToken = decodeURIComponent(match[1]);
    if (verifySessionToken(cookieToken)) {
      return true;
    }
  }

  return false;
}

