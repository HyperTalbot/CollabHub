// frontend/app/api/tracking/view/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch('http://localhost:8089/api/v1/tracking/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('Authorization') || '',
        'X-Session-ID': request.headers.get('X-Session-ID') || '',
        'X-Device-Type': request.headers.get('X-Device-Type') || '',
        'X-Platform': 'web',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to track view');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Track view error:', error);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}