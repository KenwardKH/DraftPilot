import { NextRequest, NextResponse } from 'next/server';
import { resolveAiConfig } from '@/lib/ai/provider';
import { TestConnectionSchema } from '@/lib/types/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // If body has explicit values, use them. Otherwise resolve from headers or host defaults.
    let baseUrl = body.baseUrl;
    let apiKey = body.apiKey;
    let model = body.model;

    if (!baseUrl || !apiKey || !model) {
      const resolved = resolveAiConfig(req);
      baseUrl = baseUrl || resolved.baseUrl;
      apiKey = apiKey || resolved.apiKey;
      model = model || resolved.model;
    }

    const parsed = TestConnectionSchema.safeParse({ baseUrl, apiKey, model });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { baseUrl: targetBaseUrl, apiKey: targetApiKey, model: targetModel } = parsed.data;

    // Probe 1: Try querying the /models endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const modelsRes = await fetch(`${targetBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${targetApiKey}`,
        },
        signal: controller.signal,
      });

      if (modelsRes.ok) {
        clearTimeout(timeoutId);
        return NextResponse.json({
          ok: true,
          message: `Connected successfully to gateway at ${targetBaseUrl}. Target model: ${targetModel}`,
        });
      }
    } catch {
      // If /models failed or timed out, attempt chat completion probe below
    }

    // Probe 2: Try a 1-token minimal chat completion test
    const chatController = new AbortController();
    const chatTimeoutId = setTimeout(() => chatController.abort(), 8000);

    try {
      const chatRes = await fetch(`${targetBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${targetApiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 1,
        }),
        signal: chatController.signal,
      });

      clearTimeout(chatTimeoutId);

      if (chatRes.ok) {
        return NextResponse.json({
          ok: true,
          message: `Model responded successfully: "${targetModel}" via ${targetBaseUrl}`,
        });
      } else {
        const errorText = await chatRes.text();
        let errMsg = `Gateway returned HTTP ${chatRes.status}`;
        try {
          const parsedErr = JSON.parse(errorText);
          errMsg = parsedErr.error?.message || parsedErr.message || errMsg;
        } catch {
          if (errorText.length < 200) errMsg = errorText;
        }

        return NextResponse.json({ ok: false, error: errMsg }, { status: 400 });
      }
    } catch (err) {
      clearTimeout(chatTimeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return NextResponse.json(
        { ok: false, error: isAbort ? 'Connection timed out after 8 seconds' : (err instanceof Error ? err.message : 'Connection failed') },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown test error' },
      { status: 500 }
    );
  }
}

