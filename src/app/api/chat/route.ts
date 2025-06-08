
// src/app/api/chat/route.ts
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { userThreads } from '@/lib/chat-store';

// Defer client instantiation to inside the handler

export async function POST(request: NextRequest) {
  console.log('[API Chat] POST request received.');

  const assistantId = process.env.ASSISTANT_ID;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!assistantId) {
    console.error("CRITICAL: ASSISTANT_ID environment variable is not set.");
    return NextResponse.json({ error: "Server configuration error: Assistant ID missing.", details: "ASSISTANT_ID is not configured." }, { status: 500 });
  }
  if (!openaiApiKey) {
    console.error("CRITICAL: OPENAI_API_KEY environment variable is not set.");
    return NextResponse.json({ error: "Server configuration error: OpenAI API Key missing.", details: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }
  
  const openai = new OpenAI({
    apiKey: openaiApiKey,
  });

  try {
    const body = await request.json();
    const { user_id, message } = body; // message here is the potentially augmented message from client

    if (!user_id || !message) {
      return NextResponse.json({ error: 'Missing user_id or message' }, { status: 400 });
    }
    
    console.log('[API Chat] Received in request body - FULL message (potentially augmented):', JSON.stringify(message, null, 2));


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

    // Log specifically if Reddit context appears to be in the message
    const messageContentString = typeof message === 'string' ? message : JSON.stringify(message);
    const hasSandiegoRedditContext = messageContentString.includes("Consider this from recent community discussions on r/sandiego:");
    const hasGeneralRedditContext = messageContentString.includes("Consider this from recent community discussions on general Reddit community discussions:");

    if (hasSandiegoRedditContext) {
      console.log("[API Chat] Message to OpenAI APPEARS TO INCLUDE r/sandiego Reddit context.");
    } else if (hasGeneralRedditContext) {
      console.log("[API Chat] Message to OpenAI APPEARS TO INCLUDE general Reddit context.");
    } else {
      console.log("[API Chat] Message to OpenAI DOES NOT appear to include specific Reddit context headers.");
    }
    
    console.log(`[API Chat] Creating message in thread ${threadId} for user ${user_id}. Full content string being sent to OpenAI:`, JSON.stringify(messageContentString, null, 2));

    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: messageContentString, // Send the potentially augmented message
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const runStream = await openai.beta.threads.runs.createAndStream(threadId, {
            assistant_id: assistantId,
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

    