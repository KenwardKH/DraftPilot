import { NextRequest, NextResponse } from 'next/server';
import { getNoteByProjectId, updateNote } from '@/lib/db/notes';
import { UpdateNoteSchema } from '@/lib/types/artifact';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    let note = getNoteByProjectId(projectId);
    if (!note) {
      note = updateNote(projectId, '# Project Overview\n\nNotes will be tracked here.');
    }

    return NextResponse.json({ note }, { status: 200 });
  } catch (error) {
    console.error('Failed to get note:', error);
    return NextResponse.json({ error: 'Failed to retrieve note' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { projectId, content, title } = parsed.data;
    const note = updateNote(projectId, content, title);

    return NextResponse.json({ note }, { status: 200 });
  } catch (error) {
    console.error('Failed to update note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

