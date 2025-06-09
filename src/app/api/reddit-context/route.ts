
import { NextRequest, NextResponse } from 'next/server';
// import { searchReddit, type RedditPost } from '@/services/reddit'; // Direct Reddit API calls commented out
import { fetchRedditContextViaWebSearchSimulation, type FetchRedditContextInput } from '@/ai/flows/fetch-reddit-context-via-web-search-simulation';

// Old keyword extraction and summarization logic - can be removed or kept for reference
/*
function getSearchKeywords(query: string): string {
  const qLower = query.toLowerCase();
  // Specific mappings
  if (qLower.includes('skunk spray') || (qLower.includes('dog') && qLower.includes('skunk'))) {
    return 'skunk dog experiences OR skunk removal OR dog skunk spray OR skunk odor';
  }
  if (qLower.includes('tijuana vet') || qLower.includes('tj vet')) {
    return 'tijuana vet OR tj vet experiences OR tijuana veterinarian recommendations';
  }
  // ... (other keyword mappings) ...

  // Fallback: try to extract significant words
  const words = query.replace(/[^\w\s]/gi, '').split(' ').filter(w => w.length > 3 && !['what', 'where', 'does', 'find', 'looking', 'about', 'your', 'recommendations'].includes(w.toLowerCase()));
  if (words.length > 0 && words.length <= 4) {
    return words.join(' OR ');
  }
  if (words.length > 4) {
    return words.slice(0, 4).join(' OR ');
  }
  console.log(`[API /reddit-context] getSearchKeywords: Defaulting to original query for Reddit search: "${query}"`);
  return query;
}

function summarizePosts(posts: RedditPost[], sourceLabel: string, originalQuery: string, maxLength: number = 450): string {
  if (!posts || posts.length === 0) {
    console.log(`[API /reddit-context] summarizePosts: No posts array or empty array from ${sourceLabel}.`);
    return `No specific discussions found on ${sourceLabel} for this topic recently.`;
  }

  let summaryHeader = `Context from ${sourceLabel} regarding your query:\n`;
  let summarizedContent = "";
  let postsIncludedCount = 0;

  for (const post of posts) {
    if (post.selftext?.toLowerCase().includes('[removed]') || post.selftext?.toLowerCase().includes('[deleted]')) {
        console.log(`[API /reddit-context] summarizePosts: Skipping post "${post.title}" due to [removed] or [deleted] selftext.`);
        continue;
    }
    let postItemText = `- "${post.title}"`;
    
    if (post.selftext && post.selftext.trim() !== "" && 
        post.selftext.length > 10 && // Only add if snippet is somewhat substantial
        !post.title.toLowerCase().includes(post.selftext.substring(0,15).toLowerCase()) && // Avoid repeating title
        !post.selftext.toLowerCase().startsWith(post.title.toLowerCase().substring(0,15)) 
       ) {
      const snippet = post.selftext.substring(0, 250).replace(/\n+/g, ' ').trim(); 
      postItemText += ` (User said: ${snippet}...)`;
      console.log(`[API /reddit-context] summarizePosts: Including selftext snippet for "${post.title}"`);
    } else {
      console.log(`[API /reddit-context] summarizePosts: Not including selftext for "${post.title}" (empty, too short, or too similar to title). Selftext preview: ${post.selftext?.substring(0,30)}`);
    }
    postItemText += ` (Score: ${post.score})\n`;
    
    if (summaryHeader.length + summarizedContent.length + postItemText.length > maxLength) {
      if (postsIncludedCount === 0 && (summaryHeader.length + postItemText.length <= maxLength) ) { 
        summarizedContent += postItemText;
        postsIncludedCount++;
      }
      console.log(`[API /reddit-context] summarizePosts: Max length reached. Included ${postsIncludedCount} posts.`);
      break; 
    }
    summarizedContent += postItemText;
    postsIncludedCount++;
  }

  if (postsIncludedCount === 0 || summarizedContent.trim() === "") {
     console.log(`[API /reddit-context] summarizePosts: After processing, no suitable content from posts from ${sourceLabel}.`);
     return `Could not extract a concise summary from ${sourceLabel} for this topic.`;
  }
  console.log(`[API /reddit-context] summarizePosts: Successfully summarized ${postsIncludedCount} posts from ${sourceLabel}.`);
  return summaryHeader + summarizedContent.trim();
}
*/

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  
  console.log(`[API /reddit-context] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    console.log('[API /reddit-context] Original query parameter is missing.');
    return NextResponse.json({ redditContext: 'Query parameter is required for Reddit context.', source: 'none' }, { status: 400 });
  }

  try {
    const genkitInput: FetchRedditContextInput = { userQuery: originalQuery };
    const genkitResult = await fetchRedditContextViaWebSearchSimulation(genkitInput);

    console.log(`[API /reddit-context] Genkit flow result for query "${originalQuery}": Source: ${genkitResult.source}, Summary: ${genkitResult.summary.substring(0,100)}...`);
    
    return NextResponse.json({ redditContext: genkitResult.summary, source: genkitResult.source });

  } catch (error: any) {
    console.error(`[API /reddit-context] Error calling Genkit flow for query "${originalQuery}":`, error.message, error.stack);
    return NextResponse.json({ 
      redditContext: `An error occurred while trying to generate simulated Reddit context. Please try again.`,
      source: 'simulated_reddit_search_error' 
    }, { status: 500 }); 
  }
}
