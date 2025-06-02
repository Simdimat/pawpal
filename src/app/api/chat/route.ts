
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {askPawPal, type AskPawPalInput} from '@/ai/flows/ask-pawpal';
import { getYelpContextForChat } from '@/services/yelp';
import { getPetfinderContextForChat } from '@/services/petfinder';
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
    }

    let yelpContext = '';
    let redditContext = ''; // Reddit fetching is not implemented in this step
    let petfinderContext = '';

    const lowerQuestion = question.toLowerCase();
    const locationForContext = "San Diego, CA"; // Or derive from user profile/question if possible

    // Fetch context using new service functions
    if (lowerQuestion.includes('vet') || lowerQuestion.includes('park') || lowerQuestion.includes('beach') || lowerQuestion.includes('restaurant')) {
      try {
        yelpContext = await getYelpContextForChat(lowerQuestion, locationForContext);
      } catch (e) {
        console.error("Error fetching Yelp context for chat:", e);
        yelpContext = "Could not fetch relevant information from Yelp at this time.";
      }
    }
    
    // Placeholder for Reddit context fetching (currently not implemented)
    // if (lowerQuestion.includes('skunk') || lowerQuestion.includes('stray') || lowerQuestion.includes('emergency')) {
    //   // Potentially use getEmergencyContext or a general Reddit search
    //   // redditContext = "Fetched relevant Reddit advice: ..."; 
    // }

    if (lowerQuestion.includes('shelter') || lowerQuestion.includes('adopt') || lowerQuestion.includes('volunteer') || lowerQuestion.includes('foster')) {
      try {
        petfinderContext = await getPetfinderContextForChat(lowerQuestion, locationForContext);
      } catch (e) {
        console.error("Error fetching Petfinder context for chat:", e);
        petfinderContext = "Could not fetch relevant information from Petfinder at this time.";
      }
    }
    
    const aiInput: AskPawPalInput = {
      question,
      yelpContext: yelpContext || undefined, 
      redditContext: redditContext || undefined,
      petfinderContext: petfinderContext || undefined,
    };
    
    const aiResult = await askPawPal(aiInput);
    const aiAnswer = aiResult.answer;

    // Simulate streaming for frontend
    const stream = new ReadableStream({
      async start(controller) {
        const chunkSize = 50; 
        for (let i = 0; i < aiAnswer.length; i += chunkSize) {
          controller.enqueue(new TextEncoder().encode(aiAnswer.substring(i, i + chunkSize)));
          await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        controller.close();
      }
    });
    
    if (user_identifier && session_id) {
      await saveConversation(user_identifier, session_id, question, aiAnswer);
    }
    
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('--- PawPal API Error (src/app/api/chat/route.ts) ---');
    console.error('Message:', errorMessage);
    if (errorStack) {
      console.error('Stack:', errorStack);
    }
    if (!(error instanceof Error)) {
      console.error('Full error object:', error);
    }
    console.error('--- End PawPal API Error ---');

    let clientErrorMessage = 'Failed to get response from PawPal AI. Please check server logs for details.';
    const lowerErrorMessage = errorMessage.toLowerCase();
    let httpStatus = 500; 

    if (lowerErrorMessage.includes('api key') || 
        lowerErrorMessage.includes('authentication') || 
        lowerErrorMessage.includes('permission denied') || 
        lowerErrorMessage.includes('quota') ||
        lowerErrorMessage.includes('unauthorized')) {
      clientErrorMessage = 'PawPal AI authentication or authorization error. Please ensure your AI service API key is correctly configured in the .env file and has necessary permissions/quota.';
      httpStatus = 401; 
    } else if (lowerErrorMessage.includes('503 service unavailable') || lowerErrorMessage.includes('model is overloaded') || lowerErrorMessage.includes('overloaded. please try')) {
      clientErrorMessage = 'The PawPal AI service is temporarily overloaded or unavailable. This is usually a temporary issue with the AI provider. Please try again in a few moments.';
      httpStatus = 503; 
    } else if (errorMessage) {
      // Truncate long error messages from external services
      clientErrorMessage = `PawPal AI service error: ${errorMessage.substring(0, 150)}${errorMessage.length > 150 ? '...' : ''}. Check server logs for more details.`;
    }
    
    return NextResponse.json({error: clientErrorMessage}, {status: httpStatus});
  }
}

