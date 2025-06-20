
import { NextRequest, NextResponse } from 'next/server';
import { fetchTopGoogleRedditLinksAndDebug } from '@/services/2experimental_reddit';

interface RedditContextResponse {
  context: string; // Changed from redditContext to context
  debugLogs?: string[];
  source: 'experimental_google_reddit' | 'reddit_direct_search' | 'none';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  let allDebugLogs: string[] = [];

  allDebugLogs.push(`[API /reddit-context EXPERIMENTAL] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    allDebugLogs.push('[API /reddit-context EXPERIMENTAL] Original query parameter is missing.');
    return NextResponse.json({
      context: 'Query parameter is required for Reddit context.', // Changed field name
      debugLogs: allDebugLogs,
      source: 'none'
    } as RedditContextResponse, { status: 400 });
  }

  try {
    const { summary, debugLogs: serviceDebugLogs } = await fetchTopGoogleRedditLinksAndDebug(originalQuery, 3);
    allDebugLogs.push(...serviceDebugLogs);

    let sourceUsed: RedditContextResponse['source'] = 'none';
    const lowerSummary = summary.toLowerCase();
    
    const successfulFetchIndicators = [
        "based on reddit discussions",
        "top reddit link(s) found" 
    ];

    if (successfulFetchIndicators.some(indicator => lowerSummary.includes(indicator))) {
        sourceUsed = 'experimental_google_reddit';
    }


    allDebugLogs.push(`[API /reddit-context EXPERIMENTAL] Context from experimental service (Source: ${sourceUsed}): ${summary.substring(0, 150)}...`);

    return NextResponse.json({
      context: summary, // Changed field name from redditContext to context
      debugLogs: allDebugLogs,
      source: sourceUsed
    } as RedditContextResponse);

  } catch (error: any) {
    const errorMsg = `[API /reddit-context EXPERIMENTAL] Outer error processing request: ${error.message}`;
    console.error(errorMsg, error.stack);
    allDebugLogs.push(errorMsg);
    if (error.stack) {
      allDebugLogs.push(`[API /reddit-context EXPERIMENTAL] Outer Stack: ${error.stack.substring(0, 200)}...`);
    }
    return NextResponse.json({
      context: `Error fetching experimental Reddit context (API Level): ${error.message ? error.message.substring(0, 100) : 'Unknown error'}.`, // Changed field name
      debugLogs: allDebugLogs,
      source: 'none'
    } as RedditContextResponse, { status: 500 });
  }
}
