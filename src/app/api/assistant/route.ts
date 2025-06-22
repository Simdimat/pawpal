
// src/app/api/assistant/route.ts
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { healingUserThreads } from '@/lib/healing-chat-store'; // Use the dedicated store for this chat

// Defer client instantiation to inside the handler

export async function POST(request: NextRequest) {
  console.log('[API Healing Assistant] POST request received.');

  const assistantId = process.env.ASSISTANT_ID;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!assistantId) {
    console.error("CRITICAL: ASSISTANT_ID environment variable is not set.");
    return NextResponse.json({ error: "Server configuration error: Assistant ID missing." }, { status: 500 });
  }
  if (!openaiApiKey) {
    console.error("CRITICAL: OPENAI_API_KEY environment variable is not set.");
    return NextResponse.json({ error: "Server configuration error: OpenAI API Key missing." }, { status: 500 });
  }
  
  const openai = new OpenAI({
    apiKey: openaiApiKey,
  });

  try {
    const body = await request.json();
    const { user_id, message } = body;

    if (!user_id || !message) {
      return NextResponse.json({ error: 'Missing user_id or message' }, { status: 400 });
    }
    
    console.log(`[API Healing Assistant] Received message from user ${user_id}:`, message);

    let threadId = healingUserThreads[user_id]?.thread_id;

    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      healingUserThreads[user_id] = { thread_id: threadId, last_seen: Date.now() };
      console.log(`[API Healing Assistant] New thread created for user ${user_id}: ${threadId}`);
    } else {
      healingUserThreads[user_id].last_seen = Date.now();
      console.log(`[API Healing Assistant] Using existing thread for user ${user_id}: ${threadId}`);
    }

    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const runStream = await openai.beta.threads.runs.createAndStream(threadId, {
            assistant_id: assistantId,
          });
          
          console.log(`[API Healing Assistant] Run stream initiated for thread ${threadId}.`);

          for await (const event of runStream) {
            if (event.event === 'thread.message.delta') {
              const delta = event.data.delta.content?.[0];
              if (delta?.type === 'text' && delta.text?.value) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta.text.value)}\n\n`));
              }
            } else if (event.event === 'thread.run.completed') {
              console.log(`[API Healing Assistant] Run completed for thread ${threadId}`);
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            } else if (event.event === 'thread.run.failed' || event.event === 'thread.run.cancelled' || event.event === 'thread.run.expired') {
              console.error(`[API Healing Assistant] Run failed/cancelled/expired for thread ${threadId}. Status: ${event.data.status}`, event.data.last_error);
              const runError = event.data.last_error?.message || `Run ${event.data.status}.`;
              controller.enqueue(encoder.encode(`data: [ERROR] ${JSON.stringify(runError)}\n\n`));
              controller.close();
              break;
            }
          }
        } catch (streamError: any) {
            const errorMessageText = streamError instanceof Error ? streamError.message : String(streamError);
            console.error('[API Healing Assistant] Error during run creation or stream setup:', errorMessageText, streamError.stack);
            controller.enqueue(encoder.encode(`data: [ERROR] ${JSON.stringify(`Stream error: ${errorMessageText.substring(0,150)}`)}\n\n`));
            controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    let errorMessage = "An unknown error occurred with the Assistant API.";
    if (error instanceof OpenAI.APIError) {
      console.error('--- OpenAI APIError (src/app/api/assistant/route.ts) ---', error);
      errorMessage = error.message; 
    } else if (error instanceof Error) {
      console.error('--- Generic Error (src/app/api/assistant/route.ts) ---', error);
      errorMessage = error.message; 
    } else {
      console.error('--- Unknown Error (src/app/api/assistant/route.ts) ---', error);
    }
    
    return NextResponse.json(
      { error: "Failed to get response from Assistant.", details: errorMessage },
      { status: 500 }
    );
  }
}
