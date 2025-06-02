import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

// Placeholder for Supabase client/service to save feedback
async function saveFeedback(userIdentifier: string, sessionId: string, feedbackText: string, helpful?: boolean) {
  console.log('Saving feedback:', { userIdentifier, sessionId, feedbackText, helpful });
  // In a real app, this would interact with Supabase
  // await supabase.from('feedback').insert({ user_identifier, session_id_reference: sessionId, feedback_text, context: { helpful } });
  // await supabase.from('conversations').update({ feedback_submitted_for_session: true }).eq('session_id', sessionId).eq('user_identifier', userIdentifier);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_identifier, session_id, feedback_text, helpful } = body;

    if (!session_id || !feedback_text) {
      return NextResponse.json({ error: 'Session ID and feedback text are required' }, { status: 400 });
    }
    
    const userId = user_identifier || 'anonymous_feedback_user';

    await saveFeedback(userId, session_id, feedback_text, helpful);

    return NextResponse.json({ message: 'Feedback received successfully' }, { status: 200 });
  } catch (error) {
    console.error('Feedback API Error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback.' }, { status: 500 });
  }
}
