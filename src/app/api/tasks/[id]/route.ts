import { NextRequest, NextResponse } from 'next/server';
import { getTaskById, updateTask, deleteTask } from '@/lib/db/tasks';
import { UpdateTaskSchema } from '@/lib/types/artifact';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const task = getTaskById(id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task }, { status: 200 });
  } catch (error) {
    console.error('Failed to get task:', error);
    return NextResponse.json({ error: 'Failed to retrieve task' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = updateTask(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task: updated }, { status: 200 });
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const success = deleteTask(id);

    if (!success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

