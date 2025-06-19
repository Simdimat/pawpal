import { NextRequest, NextResponse } from 'next/server';
import { fetchTopGoogleRedditLinksAndDebug } from '@/services/2experimental_reddit';

interface RedditContextResponse {
  redditContext: string;
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
      redditContext: 'Query parameter is required for Reddit context.',
      debugLogs: allDebugLogs,
      source: 'none'
    } as RedditContextResponse, { status: 400 });
  }

  try {
    const { summary, debugLogs: serviceDebugLogs } = await fetchTopGoogleRedditLinksAndDebug(originalQuery, 3);
    allDebugLogs.push(...serviceDebugLogs);

    let sourceUsed: RedditContextResponse['source'] = 'none';
    const lowerSummary = summary.toLowerCase();
    const errorOrNoResultIndicators = [
      "no organic results",
      "no reddit.com links found",
      "could not fetch relevant comments",
      "error fetching and processing reddit links",
      "error fetching experimental reddit context"
    ];

    const containsUsefulRedditContent = (
      lowerSummary.includes("based on reddit discussions") ||
      lowerSummary.includes("found reddit link") ||
      lowerSummary.includes("found link") ||
      lowerSummary.includes("reddit-specific results") ||
      lowerSummary.includes("reddit posts with comments found")
    ) && !errorOrNoResultIndicators.some(indicator => lowerSummary.includes(indicator));

    if (containsUsefulRedditContent) {
      sourceUsed = 'experimental_google_reddit';
    }

    allDebugLogs.push(`[API /reddit-context EXPERIMENTAL] Context from experimental service (Source: ${sourceUsed}): ${summary.substring(0, 150)}...`);

    return NextResponse.json({
      redditContext: summary,
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
      redditContext: `Error fetching experimental Reddit context (API Level): ${error.message ? error.message.substring(0, 100) : 'Unknown error'}.`,
      debugLogs: allDebugLogs,
      source: 'none'
    } as RedditContextResponse, { status: 500 });
  }
}
