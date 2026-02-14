import { NextResponse } from 'next/server';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
};

export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_CACHE_HEADERS });
}

export function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: NO_CACHE_HEADERS });
}

export function serverError(
  error: unknown,
  message: string = 'Internal server error'
): NextResponse {
  console.error(`[Server Error] ${message}:`, error);
  return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
}
