export const WORKSPACE_SESSION_COOKIE = 'workspace_session';
export const WORKSPACE_PASSCODE_HEADER = 'x-workspace-passcode';
export const WORKSPACE_TOKEN_HEADER = 'x-workspace-token';

/**
 * Computes SHA-256 hex digest using Web Crypto API (Edge and Node.js compatible).
 */
export async function sha256Hex(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 * Edge and Node.js compatible.
 */
export function timingSafeEqualString(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;

  let mismatch = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}

