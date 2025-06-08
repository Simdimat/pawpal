
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, type RedditPost } from '@/services/reddit';

// Function to extract simpler search terms from a conversational query
function getSearchKeywords(query: string): string {
  const qLower = query.toLowerCase();
  if (qLower.includes('skunk')) {
    return 'skunk dog experiences OR skunk removal';
  }
  if (qLower.includes('tijuana vet')) {
    return 'tijuana vet OR tj vet experiences';
  }
  if (qLower.includes('dog beach')) {
    return 'dog beach OR best dog beach';
  }
  if (qLower.includes('foster program')) {
    return 'foster program OR dog foster';
  }
  if (qLower.includes('low-cost vet') || qLower.includes('affordable vet')) {
    return 'low cost vet OR affordable vet';
  }
  if (qLower.includes('stray cat') || qLower.includes('found cat')) {
    return 'found stray cat OR stray cat help';
  }
  if (qLower.includes('stray dog') || qLower.includes('found dog')) {
    return 'found stray dog OR stray dog help';
  }
  // Fallback: try to extract nouns or key phrases, or use the first few words.
  // For simplicity now, we'll use a more generic approach if no keywords match.
  // A more advanced NLP approach could be used here in the future.
  // Let's try to take up to 3-4 significant words if no direct match.
  const words = query.split(' ').filter(w => w.length > 2); // filter out very short words
  if (words.length > 3) {
    return words.slice(0, 3).join(' ');
  }
  return query; // Default to original query if no keywords or too short
}


function summarizePosts(posts: RedditPost[], originalQuery: string, sourceLabel: string, maxLength: number = 450): string {
  if (!posts || posts.length === 0) {
    console.log(`[API /reddit-context] summarizePosts: No posts array or empty array for query "${originalQuery}" from ${sourceLabel}.`);
    return `No specific discussions found on ${sourceLabel} for "${originalQuery}" recently.`;
  }

  let summary = `Here's what some people are saying on ${sourceLabel} about "${originalQuery}":\n`;
  let currentLength = summary.length;
  let postsIncludedCount = 0;

  for (const post of posts) {
    if (post.selftext?.toLowerCase().includes('[removed]') || post.selftext?.toLowerCase().includes('[deleted]')) {
        continue;
    }
    // Prioritize title, and add selftext snippet if it's concise and not just the title repeated
    let postContent = `- "${post.title}"`;
    if (post.selftext && post.selftext.trim() !== "" && post.selftext.length < 150 && !post.selftext.toLowerCase().includes(post.title.toLowerCase().substring(0,10))) { // Avoid redundant selftext
      postContent += ` (User said: ${post.selftext.substring(0, 80).replace(/\n/g, ' ')}...)`;
    }
    postContent += ` (Score: ${post.score})\n`;
    
    if (currentLength + postContent.length > maxLength) {
      if (postsIncludedCount === 0) { 
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
     console.log(`[API /reddit-context] summarizePosts: After processing, no suitable content from posts for query "${originalQuery}" from ${sourceLabel}.`);
     return `Found some discussions on ${sourceLabel} related to "${originalQuery}", but could not extract a concise summary. General topics often include experiences and local advice.`;
  }
  return summary.trim();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query'); // User's full conversational query
  
  console.log(`[API /reddit-context] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    console.log('[API /reddit-context] Original query parameter is missing.');
    return NextResponse.json({ error: 'Query parameter is required', source: 'none' }, { status: 400 });
  }

  const redditSearchQuery = getSearchKeywords(originalQuery);
  console.log(`[API /reddit-context] Derived Reddit search keywords: "${redditSearchQuery}"`);

  let redditContext: string = "";
  let source: 'r/sandiego' | 'general_reddit' | 'none' = 'none';

  try {
    // 1. Attempt to search r/sandiego
    console.log(`[API /reddit-context] Attempting search on r/sandiego for keywords: "${redditSearchQuery}" (limit 3)`);
    const sanDiegoPosts = await searchReddit(
      redditSearchQuery,
      undefined, 
      3, // Fetch fewer for primary, more targeted
      'relevance', 
      'year',
      'sandiego' 
    );
    console.log(`[API /reddit-context] Raw Reddit Posts from r/sandiego for keywords "${redditSearchQuery}":`, JSON.stringify(sanDiegoPosts.map(p => ({title: p.title, score: p.score, selftext_preview: p.selftext?.substring(0,50)})), null, 2));
    
    redditContext = summarizePosts(sanDiegoPosts, originalQuery, 'r/sandiego');
    source = 'r/sandiego';

    // 2. If r/sandiego search yields "no specific discussions" or generic, try general Reddit
    const noResultsSanDiego = redditContext.includes("No specific discussions found on r/sandiego") || redditContext.includes("could not extract a concise summary");
    
    if (noResultsSanDiego) {
      console.log(`[API /reddit-context] r/sandiego search yielded few/no results for "${originalQuery}". Attempting general Reddit search with keywords: "${redditSearchQuery}" (limit 5)`);
      const generalPosts = await searchReddit(
        redditSearchQuery, 
        ['pets', 'dogs', 'cats', 'AskVet', 'animalrescue', 'sandiego_pets'], // Broader subreddits
        5, // Fetch a bit more for general
        'relevance',
        'month'
      );
      console.log(`[API /reddit-context] Raw Reddit Posts from general search for keywords "${redditSearchQuery}":`, JSON.stringify(generalPosts.map(p => ({title: p.title, score: p.score, selftext_preview: p.selftext?.substring(0,50)})), null, 2));
      
      const generalRedditContext = summarizePosts(generalPosts, originalQuery, 'general Reddit discussions');
      
      if (!generalRedditContext.includes("No specific discussions found on general Reddit discussions") && !generalRedditContext.includes("could not extract a concise summary")) {
        redditContext = generalRedditContext;
        source = 'general_reddit';
      } else {
        // Both searches yielded no specific results, stick with the "no results" message (r/sandiego one or a more generic one)
        source = 'none'; // Mark source as none if both failed
        redditContext = `Could not find specific community discussions for "${originalQuery}" on Reddit recently.`;
        console.log(`[API /reddit-context] Both r/sandiego and general Reddit search yielded no specific results for "${originalQuery}".`);
      }
    }
    
    console.log(`[API /reddit-context] Final Reddit Context for original query "${originalQuery}": (Source: ${source})`, redditContext);
    
    return NextResponse.json({ redditContext, source });

  } catch (error: any) {
    console.error(`[API /reddit-context] Error fetching Reddit context for original query "${originalQuery}":`, error.message, error.stack);
    return NextResponse.json({ 
      redditContext: `Could not fetch Reddit context at this time due to an error. Please try again later.`,
      source: 'none' 
    }, { status: 200 }); // Return 200 so chat can proceed with base info
  }
}
