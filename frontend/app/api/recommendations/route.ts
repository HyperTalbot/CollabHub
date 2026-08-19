// frontend/app/api/recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'post';
  const limit = searchParams.get('limit') || '20';

  try {
    const response = await fetch(
      `http://localhost:8089/api/v1/recommendations/feed?type=${type}&limit=${limit}`,
      {
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Recommendation API error:', error);
    return NextResponse.json({ data: [], page: 1, total: 0 });
  }
}