import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {askPawPal, type AskPawPalInput} from '@/ai/flows/ask-pawpal';
// import { getEmergencyContext } from '@/ai/flows/emergency-flow-context'; // If needed for specific context

// Placeholder for Supabase client/service to save chat history
async function saveConversation(userIdentifier: string, sessionId: string, userMessage: string, aiResponse: string) {
  // console.log('Saving conversation:', { userIdentifier, sessionId, userMessage, aiResponse });
  // In a real app, this would interact with Supabase via e.g. src/lib/supabase/client.ts
  // await supabase.from('conversations').insert(...) or update.
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {question, user_identifier, session_id} = body;

    if (!question) {
      return NextResponse.json({error: 'Question is required'}, {status: 400});
    }
    if (!user_identifier || !session_id) {
      // console.warn('User identifier or session ID missing, proceeding as anonymous for this message.');
      // Potentially generate temporary ones or handle as needed.
    }

    // Placeholder: Fetch context based on question.
    // In a real app, this logic would be more sophisticated.
    // It might involve another AI call for classification, keyword matching, etc.
    // For now, we'll pass empty/generic context or determined by keywords.
    let yelpContext = '';
    let redditContext = '';
    let petfinderContext = '';

    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.includes('vet') || lowerQuestion.includes('park') || lowerQuestion.includes('beach') || lowerQuestion.includes('restaurant')) {
      // yelpContext = "Fetched relevant Yelp data for San Diego: ..."; // Replace with actual Yelp API call via a service
    }
    if (lowerQuestion.includes('skunk') || lowerQuestion.includes('stray') || lowerQuestion.includes('emergency')) {
      // Potentially use getEmergencyContext or a general Reddit search
      // redditContext = "Fetched relevant Reddit advice: ..."; // Replace with actual Reddit API call
    }
    if (lowerQuestion.includes('shelter') || lowerQuestion.includes('adopt') || lowerQuestion.includes('volunteer')) {
      // petfinderContext = "Fetched relevant Petfinder data: ..."; // Replace with actual Petfinder API call
    }
    
    const aiInput: AskPawPalInput = {
      question,
      yelpContext: yelpContext || undefined, // Ensure undefined if empty, as per schema
      redditContext: redditContext || undefined,
      petfinderContext: petfinderContext || undefined,
    };
    
    // The askPawPal flow from Genkit does not directly support streaming in the way
    // a raw OpenAI SDK call would for `res.write`. It returns a Promise<AskPawPalOutput>.
    // To achieve streaming, the `askPawPalFlow` itself would need to be designed for it,
    // or we'd use the OpenAI SDK directly here with `stream: true`.
    // For now, we'll simulate streaming by sending the full response in chunks.
    // This is a limitation of using the pre-built AI flow as-is if it wasn't designed for SSE.

    const aiResult = await askPawPal(aiInput);
    const aiAnswer = aiResult.answer;

    // Simulate streaming for frontend
    const stream = new ReadableStream({
      async start(controller) {
        // Split the answer into chunks to simulate streaming
        const chunkSize = 50; // characters
        for (let i = 0; i < aiAnswer.length; i += chunkSize) {
          controller.enqueue(new TextEncoder().encode(aiAnswer.substring(i, i + chunkSize)));
          await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
        }
        controller.close();
      }
    });
    
    // Save conversation after getting the full AI response
    if (user_identifier && session_id) {
      await saveConversation(user_identifier, session_id, question, aiAnswer);
    }
    
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }, // Or text/event-stream for true SSE
    });

  } catch (error) {
    console.error('PawPal API Error:', error);
    return NextResponse.json({error: 'Failed to get response from PawPal AI.'}, {status: 500});
  }
}
