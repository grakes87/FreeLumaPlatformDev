import { NextResponse } from 'next/server';
import { sequelize } from '@/lib/db';

export async function GET() {
  try {
    await sequelize.authenticate();
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'error', db: 'disconnected', error: message },
      { status: 500 }
    );
  }
}
