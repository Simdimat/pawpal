
import { NextRequest, NextResponse } from 'next/server';
import { searchAndFetchFullRedditPosts } from '@/services/experimental_reddit'; 

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  
  console.log(`[API /reddit-context EXPERIMENTAL] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    console.log('[API /reddit-context EXPERIMENTAL] Original query parameter is missing.');
    return NextResponse.json({ 
      redditContext: 'Query parameter is required for Reddit context.', 
      debugLogs: ['[API /reddit-context EXPERIMENTAL] Original query parameter is missing.'],
      source: 'none' 
    }, { status: 400 });
  }

  try {
    // searchAndFetchFullRedditPosts now returns an object { summary: string, debugLogs: string[] }
    const { summary: experimentalContext, debugLogs: experimentalDebugLogs } = await searchAndFetchFullRedditPosts(originalQuery, 2); 
    
    let sourceUsed: 'experimental_google_reddit' | 'none' = 'none';
    if (experimentalContext && !experimentalContext.startsWith("No relevant Reddit discussions found") && !experimentalContext.startsWith("Sorry, I encountered an error") && !experimentalContext.includes("Found Reddit posts via Google, but encountered issues fetching their content")) {
        sourceUsed = 'experimental_google_reddit';
    }
    
    const logMsg = `[API /reddit-context EXPERIMENTAL] Context from experimental service (Source: ${sourceUsed}): ${experimentalContext.substring(0, 150)}...`;
    console.log(logMsg);
    // Add this API route's own log to the debug logs
    const finalDebugLogs = [...experimentalDebugLogs, logMsg];
    
    return NextResponse.json({ redditContext: experimentalContext, debugLogs: finalDebugLogs, source: sourceUsed });

  } catch (error: any) {
    const errorMsg = `[API /reddit-context EXPERIMENTAL] Error processing request: ${error.message}`;
    console.error(errorMsg, error.stack);
    return NextResponse.json({ 
      redditContext: `Error fetching experimental Reddit context: ${error.message ? error.message.substring(0,100) : 'Unknown error'}.`,
      debugLogs: [errorMsg, error.stack ? error.stack.substring(0, 200) : "No stack trace"],
      source: 'none' 
    }, { status: 500 });
  }
}
