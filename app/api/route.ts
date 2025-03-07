import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    const response = await fetch('https://api.slipshark.com/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SLIPSHARK_API_KEY!
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      return new NextResponse(
        JSON.stringify({ error: 'API request failed' }), 
        { status: response.status }
      );
    }

    // Get the response reader
    const reader = response.body?.getReader();
    const encoder = new TextEncoder();

    // Create a new readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader!.read();
            
            if (done) {
              controller.close();
              break;
            }

            // Convert the chunk to text
            const text = new TextDecoder().decode(value);
            // Parse out the actual content from SSE format
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const content = line.slice(6); // Remove 'data: ' prefix
                controller.enqueue(encoder.encode(content));
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Research API error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500 }
    );
  }
} 