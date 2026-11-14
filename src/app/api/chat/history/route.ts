import { NextRequest, NextResponse } from 'next/server';
import { listMessagesByProjectId, clearMessagesByProjectId } from '@/lib/db/messages';
import { getProjectById } from '@/lib/db/projects';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

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
    let projectId = searchParams.get('projectId');

    if (!projectId) {
      try {
        const body = await req.json();
        projectId = body.projectId;
      } catch {}
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    clearMessagesByProjectId(projectId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clear messages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
