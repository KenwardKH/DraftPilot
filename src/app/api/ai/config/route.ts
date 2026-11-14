import { NextResponse } from 'next/server';
import { getHostDefaults } from '@/lib/ai/provider';

export async function GET() {
  try {
    const hostDefaults = getHostDefaults();
    return NextResponse.json({ hostDefaults }, { status: 200 });
  } catch (error) {
    console.error('Failed to get host AI defaults:', error);
    return NextResponse.json({ error: 'Failed to retrieve AI configuration' }, { status: 500 });
  }
}

