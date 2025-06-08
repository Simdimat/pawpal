
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, type RedditPost } from '@/services/reddit';

// Function to extract simpler search terms from a conversational query
function getSearchKeywords(query: string): string {
  const qLower = query.toLowerCase();
  if (qLower.includes('skunk spray') || (qLower.includes('dog') && qLower.includes('skunk'))) {
    return 'skunk dog experiences OR skunk removal OR dog skunk spray OR skunk odor';
  }
  if (qLower.includes('tijuana vet') || qLower.includes('tj vet')) {
    return 'tijuana vet OR tj vet experiences OR tijuana veterinarian recommendations';
  }
  if (qLower.includes('dog beach')) {
    return 'dog beach san diego OR best dog beach OR off leash beach san diego';
  }
  if (qLower.includes('foster program') || qLower.includes('dog foster')) {
    return 'dog foster program san diego OR beginner friendly pet foster';
  }
  if (qLower.includes('low-cost vet') || qLower.includes('affordable vet')) {
    return 'low cost vet san diego OR affordable veterinarian OR cheap pet clinic san diego';
  }
  if (qLower.includes('stray cat') || qLower.includes('found cat')) {
    return 'found stray cat san diego OR help stray cat san diego';
  }
  if (qLower.includes('stray dog') || qLower.includes('found dog')) {
    return 'found stray dog san diego OR help stray dog san diego';
  }
  if (qLower.includes('hike with dog') || qLower.includes('dog friendly hike')) {
    return 'dog friendly hike san diego OR best dog trails OR less crowded dog hike san diego';
  }
   if (qLower.includes('pets for seniors') || qLower.includes('pet care for seniors')) {
    return 'volunteer pet care seniors san diego OR pets for elderly san diego';
  }
  
  // Fallback: try to extract significant words
  const words = query.replace(/[^\w\s]/gi, '').split(' ').filter(w => w.length > 3 && !['what', 'where', 'does', 'find', 'looking'].includes(w.toLowerCase()));
  if (words.length > 0 && words.length <= 4) {
    return words.join(' OR '); // Use OR for broader matching
  }
  if (words.length > 4) {
    return words.slice(0, 4).join(' OR '); 
  }
  console.log(`[API /reddit-context] getSearchKeywords: Defaulting to original query for Reddit search: "${query}"`);
  return query; // Default to original query if no keywords or too short/long after processing
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
        continue;
    }
    let postItemText = `- "${post.title}"`;
    // Try to include a bit more of the selftext if available and distinct
    if (post.selftext && post.selftext.trim() !== "" && !post.selftext.toLowerCase().includes(post.title.toLowerCase().substring(0,10))) {
      const snippet = post.selftext.substring(0, 250).replace(/\n/g, ' ').trim(); // Increased snippet length
      if (snippet.length > 10) { // Only add if snippet is somewhat substantial
         postItemText += ` (User said: ${snippet}...)`;
      }
    }
    postItemText += ` (Score: ${post.score})\n`;
    
    if (summaryHeader.length + summarizedContent.length + postItemText.length > maxLength) {
      if (postsIncludedCount === 0 && (summaryHeader.length + postItemText.length <= maxLength) ) { 
        summarizedContent += postItemText;
        postsIncludedCount++;
      }
      break; 
    }
    summarizedContent += postItemText;
    postsIncludedCount++;
  }

  if (postsIncludedCount === 0 || summarizedContent.trim() === "") {
     console.log(`[API /reddit-context] summarizePosts: After processing, no suitable content from posts from ${sourceLabel}.`);
     return `Could not extract a concise summary from ${sourceLabel} for this topic.`;
  }
  return summaryHeader + summarizedContent.trim();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  
  console.log(`[API /reddit-context] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    console.log('[API /reddit-context] Original query parameter is missing.');
    return NextResponse.json({ redditContext: 'Query parameter is required for Reddit context.', source: 'none' }, { status: 400 });
  }

  const redditSearchQuery = getSearchKeywords(originalQuery);
  console.log(`[API /reddit-context] Derived Reddit search keywords: "${redditSearchQuery}"`);

  let redditContext: string = "";
  let source: 'r/sandiego' | 'general_reddit' | 'none' = 'none';

  try {
    // 1. Attempt to search r/sandiego
    console.log(`[API /reddit-context] Attempting search on r/sandiego for keywords: "${redditSearchQuery}" (limit 7)`);
    const sanDiegoPosts = await searchReddit(
      redditSearchQuery,
      undefined, 
      7, 
      'relevance', 
      'year',
      'sandiego' 
    );
    console.log(`[API /reddit-context] Raw Reddit Posts from r/sandiego for keywords "${redditSearchQuery}":`, sanDiegoPosts.length > 0 ? JSON.stringify(sanDiegoPosts.map(p => ({title: p.title, score: p.score, selftext_preview: p.selftext?.substring(0,50)})).slice(0,3), null, 2) : "No posts found or error in fetching.");
    
    const sanDiegoSummary = summarizePosts(sanDiegoPosts, 'r/sandiego', originalQuery);
    console.log(`[API /reddit-context] Summarized r/sandiego context: "${sanDiegoSummary}"`);
    
    const noResultsSanDiego = !sanDiegoPosts.length ||
                              sanDiegoSummary.includes("No specific discussions found on r/sandiego") ||
                              sanDiegoSummary.includes("Could not extract a concise summary from r/sandiego");

    if (noResultsSanDiego) {
      console.log(`[API /reddit-context] r/sandiego search yielded few/no results for query related to "${originalQuery}". Attempting general Reddit search with keywords: "${redditSearchQuery}" (limit 5)`);
      // General pet-related subreddits + San Diego focused ones
      const generalSubreddits = ['pets', 'dogs', 'cats', 'AskVet', 'animalrescue', 'sandiego_pets', 'aww', 'DogAdvice', 'CatAdvice'];
      const generalPosts = await searchReddit(
        redditSearchQuery, 
        generalSubreddits,
        5, // Limit for general search
        'relevance', // Sort by relevance for broader search
        'month' // More recent for general fallback
      );
      console.log(`[API /reddit-context] Raw Reddit Posts from general search for keywords "${redditSearchQuery}":`, generalPosts.length > 0 ? JSON.stringify(generalPosts.map(p => ({title: p.title, score: p.score, selftext_preview: p.selftext?.substring(0,50)})).slice(0,3), null, 2) : "No posts found or error in fetching.");
      
      const generalRedditSummary = summarizePosts(generalPosts, 'general Reddit community discussions', originalQuery);
      console.log(`[API /reddit-context] Summarized general Reddit context: "${generalRedditSummary}"`);
      
      const noResultsGeneral = !generalPosts.length ||
                                generalRedditSummary.includes("No specific discussions found on general Reddit community discussions") ||
                                generalRedditSummary.includes("Could not extract a concise summary from general Reddit community discussions");

      if (!noResultsGeneral) {
        redditContext = generalRedditSummary;
        source = 'general_reddit';
      } else {
        source = 'none';
        redditContext = `Could not find specific community discussions for "${originalQuery}" on Reddit recently.`;
        console.log(`[API /reddit-context] Both r/sandiego and general Reddit search yielded no specific results for query related to "${originalQuery}".`);
      }
    } else {
      redditContext = sanDiegoSummary;
      source = 'r/sandiego';
    }
    
    console.log(`[API /reddit-context] Final Reddit Context for original query "${originalQuery}": (Source: ${source})`, redditContext);
    
    return NextResponse.json({ redditContext, source });

  } catch (error: any) {
    console.error(`[API /reddit-context] Error fetching Reddit context for original query "${originalQuery}":`, error.message, error.stack);
    // Return a 200 so chat can proceed, but indicate failure to fetch context
    return NextResponse.json({ 
      redditContext: `Could not fetch Reddit context at this time due to an error. Please try again later.`,
      source: 'none' 
    }, { status: 200 }); 
  }
}

