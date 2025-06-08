
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {askPawPal, type AskPawPalInput} from '@/ai/flows/ask-pawpal';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, chatUserId } = body;

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const flowInput: AskPawPalInput = { question, chatUserId };
    
    console.log('[API Genkit Chat] Calling askPawPal flow with input:', flowInput);
    const result = await askPawPal(flowInput);
    console.log('[API Genkit Chat] Received result from askPawPal flow:', result);
    
    return NextResponse.json(result, {status: 200});

  } catch (error: any) {
    console.error('[API Genkit Chat] Error in Genkit chat API route:', error);
    let errorMessage = 'Failed to get response from PawPal AI.';
    if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    // Check for Genkit specific error structure if any
    // if (error.details) errorMessage += ` Details: ${error.details}`;
    
    return NextResponse.json({ error: 'PawPal AI service error.', details: errorMessage }, { status: 500 });
  }
}
