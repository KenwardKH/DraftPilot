'use client';

import React, { useState, useEffect } from 'react';
import { BYOK_SETTINGS_KEY } from '@/lib/constants';
import { AiSettings } from '@/lib/types/ai';
import {
  X,
  Settings,
  Sparkles,
  Server,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

export function SettingsModal({ isOpen, onClose, onSettingsChanged }: SettingsModalProps) {
  const [hostDefaults, setHostDefaults] = useState<{ baseUrl: string; model: string; hasKey: boolean } | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Load host defaults and stored BYOK settings
  useEffect(() => {
    if (!isOpen) return;

    // Fetch host defaults
    fetch('/api/ai/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.hostDefaults) {
          setHostDefaults(data.hostDefaults);
        }
      })
      .catch((err) => console.error('Failed to load host AI defaults:', err));

    // Load saved BYOK settings from localStorage
    try {
      const stored = localStorage.getItem(BYOK_SETTINGS_KEY);
      if (stored) {
        const parsed: AiSettings = JSON.parse(stored);
        setIsCustom(parsed.isCustom);
        setBaseUrl(parsed.baseUrl || '');
        setApiKey(parsed.apiKey || '');
        setModel(parsed.model || '');
      } else {
        setIsCustom(false);
        setBaseUrl('');
        setApiKey('');
        setModel('');
      }
    } catch (err) {
      console.error('Failed to parse BYOK settings:', err);
    }

    setTestResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      const payload = isCustom
        ? { baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() }
        : {};

      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: data.message });
      } else {
        setTestResult({ ok: false, message: data.error || 'Failed to connect' });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Network error testing connection',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    try {
      if (isCustom) {
        const settings: AiSettings = {
          isCustom: true,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          model: model.trim(),
        };
        localStorage.setItem(BYOK_SETTINGS_KEY, JSON.stringify(settings));
      } else {
        localStorage.removeItem(BYOK_SETTINGS_KEY);
      }

      if (onSettingsChanged) onSettingsChanged();
      onClose();
    } catch (err) {
      console.error('Failed to save BYOK settings:', err);
    }
  };

  const handleResetToHost = () => {
    localStorage.removeItem(BYOK_SETTINGS_KEY);
    setIsCustom(false);
    setBaseUrl('');
    setApiKey('');
    setModel('');
    setTestResult(null);
    if (onSettingsChanged) onSettingsChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-lg rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 bg-slate-900/90">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="shrink-0 rounded-lg bg-indigo-600/20 p-2 text-indigo-400 border border-indigo-500/30">
              <Settings className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-xs sm:text-sm font-semibold text-white truncate">AI Gateway & BYOK Settings</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Configure local 9Router or custom AI provider endpoints.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition shrink-0"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs">
          {/* Section 1: Host Environment Defaults */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Server className="h-3.5 w-3.5 text-indigo-400" />
                <span>Host Server Defaults (.env.local)</span>
              </div>
              <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/60">
                Active Default
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="rounded-lg bg-slate-900/90 p-2.5 border border-slate-800/80">
                <span className="text-slate-500 block">Base URL</span>
                <span className="font-mono text-slate-200 truncate block">
                  {hostDefaults?.baseUrl || 'http://localhost:20128/v1'}
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 border border-slate-800/80">
                <span className="text-slate-500 block">Default Model</span>
                <span className="font-mono text-slate-200 truncate block">
                  {hostDefaults?.model || 'gemini-2.5-flash'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              When BYOK is disabled, all chat and tool calls route directly to this local gateway without requiring keys from guests.
            </p>
          </div>

          {/* Section 2: BYOK Override Toggle */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-3.5">
              <div className="flex items-center gap-2.5 pr-2">
                <Key className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Custom BYOK Override</span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 block">
                    Use your own API key (stored strictly in browser localStorage).
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isCustom}
                  onChange={(e) => setIsCustom(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Custom Inputs (Displayed when isCustom is active) */}
            {isCustom && (
              <div className="space-y-3 rounded-xl border border-indigo-950/60 bg-indigo-950/10 p-3.5 sm:p-4 animate-in fade-in duration-200">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    OpenAI-Compatible Base URL <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="url"
                    placeholder="e.g. http://localhost:20128/v1 or https://openrouter.ai/api/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 sm:py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    API Key <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 sm:py-2 pr-9 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Model Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. gemini-2.5-flash, gpt-4o-mini, coding-free"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 sm:py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Connection Banner */}
          {testResult && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                testResult.ok
                  ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-rose-800/60 bg-rose-950/40 text-rose-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="text-[11px] leading-relaxed">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-slate-800 px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-900/90">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || (isCustom && (!baseUrl || !apiKey || !model))}
            className="min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition disabled:opacity-50 w-full sm:w-auto"
          >
            {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" /> : <Zap className="h-3.5 w-3.5 text-amber-400" />}
            <span>Test Connection</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isCustom && (
              <button
                type="button"
                onClick={handleResetToHost}
                className="min-h-[40px] flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white transition"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              className="min-h-[40px] flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
            >
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

