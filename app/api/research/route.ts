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
      body: JSON.stringify({ 
        query,
        platform: 'web'  // Adding platform identifier
      })
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
    const decoder = new TextDecoder();

    // Create a new readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = '';

          while (true) {
            const { done, value } = await reader!.read();
            
            if (done) {
              if (buffer.trim()) {
                const content = buffer.trim();
                if (content && !content.includes('[DONE]')) {
                  controller.enqueue(encoder.encode(content));
                }
              }
              controller.close();
              break;
            }

            // Decode the chunk and add to buffer
            const text = decoder.decode(value, { stream: true });
            buffer += text;
            
            // Process each complete SSE message
            const messages = buffer.split('\n\n');
            // Keep the last (potentially incomplete) message in the buffer
            buffer = messages.pop() || '';

            for (const message of messages) {
              const lines = message.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const content = line.slice(6);
                  if (content && !content.includes('[DONE]')) {
                    // Pass through the content with minimal processing
                    controller.enqueue(encoder.encode(content));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
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