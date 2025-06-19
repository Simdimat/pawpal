
import { NextRequest, NextResponse } from 'next/server';
// Ensure the correct function is imported from the experimental service
import { fetchTopGoogleRedditLinksAndDebug } from '@/services/experimental_reddit'; 
// Comment out direct Reddit service imports for this test
// import { searchReddit, fetchPostComments, type RedditPost, type RedditComment } from '@/services/reddit';

interface RedditContextResponse {
  redditContext: string;
  debugLogs?: string[]; // Optional, but experimental_reddit service will provide it
  source: 'experimental_google_reddit' | 'reddit_direct_search' | 'none';
}

// Helper function to extract keywords (can be refined)
function extractKeywords(query: string): string {
  const commonWords = new Set(['my', 'is', 'a', 'the', 'what', 'do', 'i', 'for', 'in', 'on', 'how', 'to', 'help', 'dog', 'cat', 'pet', 'was', 'got', 'by']);
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(word => !commonWords.has(word) && word.length > 2)
    .slice(0, 5)
    .join(' ');
  return keywords || query;
}


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  let allDebugLogs: string[] = [];
  
  allDebugLogs.push(`[API /reddit-context EXPERIMENTAL] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    allDebugLogs.push('[API /reddit-context EXPERIMENTAL] Original query parameter is missing.');
    return NextResponse.json({ 
      redditContext: 'Query parameter is required for Reddit context.', 
      debugLogs: allDebugLogs,
      source: 'none' 
    } as RedditContextResponse, { status: 400 });
  }

  try {
    // Call the simplified experimental service function
    const { summary, debugLogs: serviceDebugLogs } = await fetchTopGoogleRedditLinksAndDebug(originalQuery, 3);
    allDebugLogs.push(...serviceDebugLogs);
    
    const sourceUsed: RedditContextResponse['source'] = summary.startsWith("Top") || summary.startsWith("No relevant Reddit links") ? 'experimental_google_reddit' : 'none';
    
    allDebugLogs.push(`[API /reddit-context EXPERIMENTAL] Context from experimental service (Source: ${sourceUsed}): ${summary.substring(0, 150)}...`);
    
    return NextResponse.json({ redditContext: summary, debugLogs: allDebugLogs, source: sourceUsed } as RedditContextResponse);

  } catch (error: any) {
    const errorMsg = `[API /reddit-context EXPERIMENTAL] Outer error processing request: ${error.message}`;
    console.error(errorMsg, error.stack); // Keep server console error
    allDebugLogs.push(errorMsg);
    if (error.stack) {
        allDebugLogs.push(`[API /reddit-context EXPERIMENTAL] Outer Stack: ${error.stack.substring(0, 200)}...`);
    }
    return NextResponse.json({ 
      redditContext: `Error fetching experimental Reddit context (API Level): ${error.message ? error.message.substring(0,100) : 'Unknown error'}.`,
      debugLogs: allDebugLogs,
      source: 'none' 
    } as RedditContextResponse, { status: 500 });
  }
}
