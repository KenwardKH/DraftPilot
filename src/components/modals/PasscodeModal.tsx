'use client';

import React, { useState } from 'react';
import { Lock, KeyRound, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

interface PasscodeModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export function PasscodeModal({ isOpen, onSuccess }: PasscodeModalProps) {
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Also persist in sessionStorage for fallback header injection if cookies are partitioned in tunnels
        if (typeof window !== 'undefined' && data.token) {
          sessionStorage.setItem('workspace_token', data.token);
        }
        onSuccess();
      } else {
        setErrorMessage(
          data.error === 'INVALID_PASSCODE'
            ? 'Incorrect passcode. Please check your credentials.'
            : data.error || 'Failed to authenticate passcode'
        );
      }
    } catch (err) {
      console.error('Passcode unlock error:', err);
      setErrorMessage('Network error while verifying passcode.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Workspace Locked</h3>
            <p className="text-xs text-slate-400">Passcode protection is enabled for this workspace</p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
          <span>
            This host is running in protected mode via <code className="text-indigo-300">WORKSPACE_PASSCODE</code>. Enter the passcode to unlock database and AI features.
          </span>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-800/60 p-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Workspace Passcode
            </label>
            <div className="relative">
              <input
                type="password"
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 pl-9 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <KeyRound className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !passcode.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 shadow-md shadow-indigo-600/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Unlock Workspace</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
