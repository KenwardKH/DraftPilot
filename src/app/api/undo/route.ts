import { NextRequest, NextResponse } from 'next/server';
import { UndoRequestSchema } from '@/lib/types/snapshot';
import { restoreUndoSnapshot } from '@/lib/db/snapshots';

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }
    const parseResult = UndoRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid undo request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { snapshotId } = parseResult.data;

    try {
      const result = restoreUndoSnapshot(snapshotId);
      return NextResponse.json({ success: true, projectId: result.projectId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Snapshot restoration failed';
      if (message.includes('not found')) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Undo request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

