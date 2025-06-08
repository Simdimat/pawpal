// src/app/api/chat-history/route.ts
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { userThreads } from '@/lib/chat-store';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set.");
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const threadId = userThreads[user_id]?.thread_id;

    if (!threadId) {
      console.log(`[API History] No thread found for user ${user_id}. Returning empty history.`);
      return NextResponse.json({ conversation: [] });
    }
    console.log(`[API History] Fetching history for user ${user_id}, thread ${threadId}`);

    const messagesPage = await openai.beta.threads.messages.list(threadId, {
      order: 'asc', // Fetch messages in chronological order
    });
    
    const conversation = messagesPage.data.map(msg => {
      let textContent = '';
      if (msg.content[0]?.type === 'text') {
        textContent = msg.content[0].text.value;
      }
      return {
        id: msg.id,
        text: textContent,
        sender: msg.role === 'user' ? 'user' : 'ai',
        timestamp: new Date(msg.created_at * 1000), // Convert Unix timestamp to Date
      };
    }).filter(msg => msg.text.trim() !== ''); // Filter out potentially empty messages if any

    return NextResponse.json({ conversation });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching chat history: ${errorMessage}`, error.stack);
    return NextResponse.json({ error: 'Failed to fetch chat history.', details: errorMessage }, { status: 500 });
  }
}
