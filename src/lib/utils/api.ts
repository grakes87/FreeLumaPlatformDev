import { NextResponse } from 'next/server';

export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(
  error: unknown,
  message: string = 'Internal server error'
): NextResponse {
  console.error(`[Server Error] ${message}:`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
