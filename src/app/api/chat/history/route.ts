import { NextRequest, NextResponse } from 'next/server';
import { listMessagesByProjectId, clearMessagesByProjectId } from '@/lib/db/messages';
import { getProjectById } from '@/lib/db/projects';
import { ChatHistoryQuerySchema, DeleteChatHistorySchema } from '@/lib/types/chat';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parseResult = ChatHistoryQuerySchema.safeParse({
      projectId: searchParams.get('projectId') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId } = parseResult.data;
    const project = getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const messages = listMessagesByProjectId(projectId);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve messages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let rawProjectId = searchParams.get('projectId');

    if (!rawProjectId) {
      try {
        const body = await req.json();
        rawProjectId = body.projectId;
      } catch {}
    }

    const parseResult = DeleteChatHistorySchema.safeParse({
      projectId: rawProjectId,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid delete request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId } = parseResult.data;
    clearMessagesByProjectId(projectId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clear messages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
