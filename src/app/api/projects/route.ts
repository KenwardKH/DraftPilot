import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/db/projects';
import { CreateProjectSchema } from '@/lib/types/project';

export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    console.error('Failed to list projects:', error);
    return NextResponse.json({ error: 'Failed to retrieve projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const project = createProject(parsed.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

