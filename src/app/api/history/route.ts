// This API route fetches history for a generic OpenAI Assistant endpoint.
// It can be used by other parts of the application.

import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import OpenAI from 'openai';
import { healingChatThreads as userThreads } from '@/lib/healing-chat-store';

export async function GET(request: NextRequest) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return NextResponse.json({ error: "Server configuration error: OPENAI_API_KEY is not set." }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const threadId = userThreads[user_id]?.thread_id;

    if (!threadId) {
      return NextResponse.json({ messages: [] });
    }

    const messagesPage = await openai.beta.threads.messages.list(threadId, {
      order: 'asc',
    });
    
    const formattedMessages = messagesPage.data.map(msg => {
        const textContent = msg.content[0]?.type === 'text' ? msg.content[0].text.value : '';
        return {
            id: msg.id,
            role: msg.role,
            content: textContent,
            created_at: msg.created_at,
        };
    }).filter(msg => msg.content.trim() !== '');

    return NextResponse.json({ messages: formattedMessages });

  } catch (error: any) {
    console.error(`Error fetching chat history from /api/history:`, error);
    return NextResponse.json({ error: 'Failed to fetch chat history.', details: error.message }, { status: 500 });
  }
}
