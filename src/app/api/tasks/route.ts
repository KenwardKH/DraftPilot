import { NextRequest, NextResponse } from 'next/server';
import { listTasksByProjectId, createTask } from '@/lib/db/tasks';
import { CreateTaskSchema } from '@/lib/types/artifact';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const tasks = listTasksByProjectId(projectId);
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (error) {
    console.error('Failed to list tasks:', error);
    return NextResponse.json({ error: 'Failed to retrieve tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { projectId, title, priority, section } = parsed.data;
    const task = createTask(projectId, { title, priority, section });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

