
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, type RedditPost } from '@/services/reddit';

function summarizePosts(posts: RedditPost[], query: string, sourceLabel: string, maxLength: number = 400): string {
  if (!posts || posts.length === 0) {
    console.log(`[API /reddit-context] summarizePosts: No posts found for query "${query}" from ${sourceLabel}.`);
    return `No specific discussions found on ${sourceLabel} for "${query}" recently.`;
  }

  let summary = `Here's what some people are saying on ${sourceLabel} about "${query}":\n`;
  let currentLength = summary.length;
  let postsIncludedCount = 0;

  for (const post of posts) {
    if (post.selftext?.toLowerCase().includes('[removed]') || post.selftext?.toLowerCase().includes('[deleted]')) {
        continue;
    }
    let postContent = `- "${post.title}"`;
    if (post.selftext && post.selftext.trim() !== "" && post.selftext.length < 120 ) {
      postContent += ` (User said: ${post.selftext.substring(0, 70).replace(/\n/g, ' ')}...)`;
    }
    postContent += ` (Score: ${post.score})\n`;
    
    if (currentLength + postContent.length > maxLength) {
      if (postsIncludedCount === 0) { // Ensure at least one post is included if possible, even if it slightly exceeds length
        summary += postContent;
        postsIncludedCount++;
      }
      break; 
    }
    summary += postContent;
    postsIncludedCount++;
    currentLength += postContent.length;
  }

  if (postsIncludedCount === 0) {
     console.log(`[API /reddit-context] summarizePosts: Even after processing, no suitable content from posts for query "${query}" from ${sourceLabel}.`);
     return `Found some discussions on ${sourceLabel} related to "${query}", but could not extract a concise summary. General topics often include experiences and local advice.`;
  }
  return summary.trim();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  console.log(`[API /reddit-context] Received GET request for query: "${query}"`);

  if (!query) {
    console.log('[API /reddit-context] Query parameter is missing.');
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  let redditContext: string;
  let source: 'r/sandiego' | 'general_reddit' | 'none' = 'none';

  try {
    // 1. Attempt to search r/sandiego
    console.log(`[API /reddit-context] Attempting search on r/sandiego for query: "${query}"`);
    const sanDiegoPosts = await searchReddit(
      query,
      undefined, 
      10,
      'relevance', 
      'year',
      'sandiego' 
    );
    console.log(`[API /reddit-context] Raw Reddit Posts from r/sandiego for query "${query}":`, JSON.stringify(sanDiegoPosts.map(p => ({title: p.title, score: p.score, selftext_preview: p.selftext?.substring(0,50)})), null, 2));
    
    redditContext = summarizePosts(sanDiegoPosts, query, 'r/sandiego');
    source = 'r/sandiego';

    // 2. If r/sandiego search yields "no specific discussions" or very generic, try general Reddit
    if (redditContext.includes("No specific discussions found on r/sandiego") || redditContext.includes("could not extract a concise summary")) {
      console.log(`[API /reddit-context] r/sandiego search yielded few/no results for "${query}". Attempting general Reddit search.`);
      const generalPosts = await searchReddit(
        query, // General query
        ['pets', 'dogs', 'cats', 'AskVet', 'animalrescue'], // Example general pet subreddits + broader search
        10,
        'relevance',
        'month' // Shorter timeframe for general to get more recent general advice
      );
      console.log(`[API /reddit-context] Raw Reddit Posts from general search for query "${query}":`, JSON.stringify(generalPosts.map(p => ({title: p.title, score: p.score, selftext_preview: p.selftext?.substring(0,50)})), null, 2));
      
      const generalRedditContext = summarizePosts(generalPosts, query, 'general Reddit discussions');
      // Only use general context if it's more informative than the r/sandiego attempt
      if (!generalRedditContext.includes("No specific discussions found on general Reddit discussions") && !generalRedditContext.includes("could not extract a concise summary")) {
        redditContext = generalRedditContext;
        source = 'general_reddit';
      } else if (source === 'r/sandiego' && (redditContext.includes("No specific discussions found on r/sandiego") || redditContext.includes("could not extract a concise summary"))) {
        // If both failed to give specific summaries, mark source as none.
        source = 'none';
         redditContext = `Could not find specific community discussions for "${query}" on Reddit recently.`;
      }
       // If r/sandiego gave a generic summary and general also gave generic, stick with the r/sandiego generic if it's slightly better or just mark as none.
    }
    
    console.log(`[API /reddit-context] Final Reddit Context for query "${query}": (Source: ${source})`, redditContext);
    
    return NextResponse.json({ redditContext, source });

  } catch (error: any) {
    console.error(`[API /reddit-context] Error fetching Reddit context for query "${query}":`, error.message);
    // In case of error, provide a neutral message that doesn't imply successful fetching.
    return NextResponse.json({ 
      redditContext: `Could not fetch Reddit context at this time due to an error. Please try again later.`,
      source: 'none' 
    }, { status: 200 }); // Return 200 so chat can proceed with base info
  }
}
