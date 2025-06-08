
// src/app/api/chat/route.ts
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { userThreads } from '@/lib/chat-store';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

export async function POST(request: NextRequest) {
  console.log('[API Chat] POST request received.');
  console.log(`[API Chat] OPENAI_API_KEY is set: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`[API Chat] ASSISTANT_ID: ${ASSISTANT_ID}`);

  if (!ASSISTANT_ID) {
    console.error("CRITICAL: ASSISTANT_ID environment variable is not set.");
    // Send a structured error to the client
    return NextResponse.json({ error: "Server configuration error: Assistant ID missing.", details: "ASSISTANT_ID is not configured." }, { status: 500 });
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("CRITICAL: OPENAI_API_KEY environment variable is not set.");
    return NextResponse.json({ error: "Server configuration error: OpenAI API Key missing.", details: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

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
        try {
          // Use createAndStream and remove model override
          const runStream = await openai.beta.threads.runs.createAndStream(threadId, {
            assistant_id: ASSISTANT_ID,
            // No model override here; relies on the Assistant's configuration
          });
          
          console.log(`[API Chat] Run stream initiated for thread ${threadId}.`);

          for await (const event of runStream) {
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
              const runError = event.data.last_error?.message || `Run ${event.data.status}.`;
              controller.enqueue(encoder.encode(`data: [ERROR] ${JSON.stringify(runError)}\n\n`));
              controller.close();
              break;
            } else if (event.event === 'thread.run.requires_action') {
              console.warn(`[API Chat] Run for thread ${threadId} requires action. This is not handled in the current implementation. Run ID: ${event.data.id}`, event.data);
              const requiresActionError = `Assistant run requires action (e.g. tool call) which is not handled. Run ID: ${event.data.id}`;
              controller.enqueue(encoder.encode(`data: [ERROR] ${JSON.stringify(requiresActionError)}\n\n`));
              controller.close();
              break;
            }
          }
        } catch (streamError: any) {
            const errorMessageText = streamError instanceof Error ? streamError.message : String(streamError);
            console.error('[API Chat] Error during run creation or stream setup:', errorMessageText, streamError.stack);
            // Ensure error messages are JSON stringified for client parsing
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
    let errorDetails = ""; 

    if (error instanceof OpenAI.APIError) {
      console.error('--- OpenAI APIError (src/app/api/chat/route.ts) ---');
      console.error('Status:', error.status);
      console.error('Message:', error.message);
      console.error('Code:', error.code);
      console.error('Type:', error.type);
      errorMessage = error.message; 
      errorDetails = `OpenAI API Error (Status: ${error.status}, Type: ${error.type}, Code: ${error.code})`;
    } else if (error instanceof Error) {
      console.error('--- Generic Error (src/app/api/chat/route.ts) ---');
      console.error('Message:', error.message);
      if (error.stack) console.error('Stack:', error.stack);
      errorMessage = error.message; 
      errorDetails = error.name || "Generic Error";
    } else {
      console.error('--- Unknown Error (src/app/api/chat/route.ts) ---');
      console.error('Full error object:', error);
      errorDetails = String(error);
    }
    
    return NextResponse.json(
      { error: "Failed to get response from Assistant.", details: errorMessage, verboseErrorDetails: errorDetails },
      { status: 500 }
    );
  }
}
