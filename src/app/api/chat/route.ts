import { NextRequest, NextResponse } from 'next/server';
import { SendMessageSchema, Message } from '@/lib/types/chat';
import { getProjectById } from '@/lib/db/projects';
import { listMessagesByProjectId, saveMessage } from '@/lib/db/messages';
import { resolveAiConfig } from '@/lib/ai/provider';
import { buildProjectSystemPrompt } from '@/lib/ai/context';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = SendMessageSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid message request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, content } = parseResult.data;

    const project = getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Resolve AI configuration (BYOK headers take priority, then .env.local)
    const config = resolveAiConfig(req);
    if (!config.baseUrl || !config.model || !config.apiKey) {
      return NextResponse.json(
        { error: 'MISSING_AI_CONFIG' },
        { status: 400 }
      );
    }

    // 2. Persist user message to SQLite
    saveMessage(projectId, 'user', content);

    // 3. Assemble context & message history
    const systemPrompt = buildProjectSystemPrompt(projectId);
    const pastMessages = listMessagesByProjectId(projectId);

    // Convert to OpenAI chat completion format
    const messages = [
      { role: 'system', content: systemPrompt },
      ...pastMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // 4. Request streaming completion from AI Gateway
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: true,
        }),
      });
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Connection failed';
      return NextResponse.json(
        { error: `Could not reach AI provider at ${config.baseUrl}: ${errMsg}` },
        { status: 502 }
      );
    }

    if (!upstreamResponse.ok) {
      let errorDetails = '';
      try {
        errorDetails = await upstreamResponse.text();
      } catch {}
      return NextResponse.json(
        { error: `AI Gateway returned error (${upstreamResponse.status}): ${errorDetails || upstreamResponse.statusText}` },
        { status: upstreamResponse.status }
      );
    }

    if (!upstreamResponse.body) {
      return NextResponse.json({ error: 'Upstream provider returned an empty response body' }, { status: 502 });
    }

    // 5. Stream response tokens via Server-Sent Events (SSE)
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstreamResponse.body.getReader();

    let fullAssistantContent = '';
    let isSaved = false;

    const stream = new ReadableStream({
      async pull(controller) {
        let buffer = '';

        const flushAssistantMessage = () => {
          if (isSaved) return;
          isSaved = true;

          let savedMsg: Message | null = null;
          if (fullAssistantContent.trim().length > 0) {
            savedMsg = saveMessage(projectId, 'assistant', fullAssistantContent);
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', message: savedMsg })}\n\n`)
          );
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;

              const dataStr = trimmed.replace(/^data:\s*/, '');
              if (dataStr === '[DONE]') {
                flushAssistantMessage();
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const deltaContent = parsed.choices?.[0]?.delta?.content;
                if (deltaContent) {
                  fullAssistantContent += deltaContent;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'token', content: deltaContent })}\n\n`)
                  );
                }
              } catch {
                // Ignore incomplete or malformed intermediate lines
              }
            }
          }

          // In case stream ends without explicit [DONE] marker
          flushAssistantMessage();
          controller.close();
        } catch (streamErr: unknown) {
          const streamErrMsg = streamErr instanceof Error ? streamErr.message : 'Streaming failure';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: streamErrMsg })}\n\n`)
          );
          controller.close();
        }
      },
      cancel() {
        reader.cancel();
        if (!isSaved && fullAssistantContent.trim().length > 0) {
          saveMessage(projectId, 'assistant', fullAssistantContent);
          isSaved = true;
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Chat processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
