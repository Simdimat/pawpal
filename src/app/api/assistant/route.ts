// This API route is a generic OpenAI Assistant endpoint.
// It can be used by other parts of the application that need to interact
// with a different assistant than the main PawPal one.

import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { healingChatThreads as userThreads } from '@/lib/healing-chat-store';

export async function POST(request: NextRequest) {
  const assistantId = process.env.ASSISTANT_ID_HEALING || process.env.ASSISTANT_ID;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    return NextResponse.json({ error: "Server configuration error: OPENAI_API_KEY is not set." }, { status: 500 });
  }
  if (!assistantId) {
    return NextResponse.json({ error: "Server configuration error: An Assistant ID is not set (ASSISTANT_ID_HEALING or ASSISTANT_ID)." }, { status: 500 });
  }
  
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const body = await request.json();
    const { user_id, message } = body;

    if (!user_id || !message) {
      return NextResponse.json({ error: 'Missing user_id or message' }, { status: 400 });
    }

    let threadId = userThreads[user_id]?.thread_id;

    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      userThreads[user_id] = { thread_id: threadId, last_seen: Date.now() };
    } else {
        userThreads[user_id].last_seen = Date.now();
    }

    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    const stream = openai.beta.threads.runs.createAndStream(threadId, {
      assistant_id: assistantId,
    });
    
    // The stream is already in the correct SSE format, so we can return it directly.
    return new Response(stream.toReadableStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Error in /api/assistant route:', error);
    return NextResponse.json({ error: "Failed to get response from Assistant.", details: error.message }, { status: 500 });
  }
}
