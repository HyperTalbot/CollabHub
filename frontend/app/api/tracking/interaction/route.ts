// frontend/app/api/tracking/interaction/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch('http://localhost:8089/api/v1/tracking/interaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('Authorization') || '',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to track interaction');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Track interaction error:', error);
    return NextResponse.json({ error: 'Failed to track interaction' }, { status: 500 });
  }
}