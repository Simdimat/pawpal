
// src/app/api/history/route.ts
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { healingUserThreads } from '@/lib/healing-chat-store'; // Use the dedicated store for this chat

// Defer client instantiation to inside the handler

export async function GET(request: NextRequest) {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    console.error("CRITICAL: OPENAI_API_KEY environment variable is not set for chat history.");
    return NextResponse.json({ error: "Server configuration error: OpenAI API Key missing for chat history." }, { status: 500 });
  }

  const openai = new OpenAI({
    apiKey: openaiApiKey,
  });

  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const threadId = healingUserThreads[user_id]?.thread_id;

    if (!threadId) {
      console.log(`[API Healing History] No thread found for user ${user_id}. Returning empty history.`);
      return NextResponse.json({ conversation: [] });
    }
    console.log(`[API Healing History] Fetching history for user ${user_id}, thread ${threadId}`);

    const messagesPage = await openai.beta.threads.messages.list(threadId, {
      order: 'asc', // Fetch messages in chronological order
    });
    
    // Format the response to match what the healing_public-index.html frontend expects
    const conversation = messagesPage.data.map(msg => {
      let textContent = '';
      if (msg.content[0]?.type === 'text') {
        textContent = msg.content[0].text.value;
      }
      return {
        role: msg.role, // 'user' or 'assistant'
        content: textContent,
      };
    }).filter(msg => msg.content.trim() !== ''); // Filter out potentially empty messages if any

    return NextResponse.json({ conversation });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching healing chat history: ${errorMessage}`, error.stack);
    return NextResponse.json({ error: 'Failed to fetch chat history.', details: errorMessage }, { status: 500 });
  }
}
