// src/app/api/chat/route.ts
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { userThreads } from '@/lib/chat-store';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!ASSISTANT_ID) {
  throw new Error("ASSISTANT_ID environment variable is not set.");
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set.");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
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
      console.log(`[API Chat] New thread created for user ${user_id}: ${threadId}`);
    } else {
      userThreads[user_id].last_seen = Date.now();
      console.log(`[API Chat] Using existing thread for user ${user_id}: ${threadId}`);
    }

    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const run = await openai.beta.threads.runs.createAndPoll(threadId, {
          assistant_id: ASSISTANT_ID,
          stream: true,
        });
        
        console.log(`[API Chat] Run created for thread ${threadId}, status: ${run.status}`);

        for await (const event of run) {
          if (event.event === 'thread.message.delta') {
            const delta = event.data.delta.content?.[0];
            if (delta?.type === 'text' && delta.text?.value) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta.text.value)}\n\n`));
            }
          } else if (event.event === 'thread.run.completed') {
            console.log(`[API Chat] Run completed for thread ${threadId}`);
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            break;
          } else if (event.event === 'thread.run.failed' || event.event === 'thread.run.cancelled' || event.event === 'thread.run.expired') {
            console.error(`[API Chat] Run failed/cancelled/expired for thread ${threadId}. Status: ${event.data.status}`, event.data.last_error);
            controller.enqueue(encoder.encode('data: [ERROR] Run failed or was cancelled.\n\n'));
            controller.close();
            break;
          }
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('--- OpenAI Assistant API Error (src/app/api/chat/route.ts) ---');
    console.error('Message:', errorMessage);
    if (errorStack) console.error('Stack:', errorStack);
    if (!(error instanceof Error)) console.error('Full error object:', error);
    console.error('--- End OpenAI Assistant API Error ---');
    return NextResponse.json({ error: `Failed to get response from Assistant. ${errorMessage}` }, { status: 500 });
  }
}
