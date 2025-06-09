
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, type RedditPost } from '@/services/reddit';
// Removed: import { fetchRedditContextViaWebSearchSimulation, type FetchRedditContextInput } from '@/ai/flows/fetch-reddit-context-via-web-search-simulation';

// Keywords for Reddit search based on common user queries
const redditKeywords: Record<string, string> = {
  skunk: "skunk dog experiences OR skunk removal OR dog skunk spray OR skunk odor",
  vet: "vet recommendation OR veterinarian experiences OR emergency vet OR low cost vet",
  beach: "dog friendly beach OR off leash beach OR dog beach rules",
  park: "dog park OR off leash park OR dog friendly park amenities",
  adopt: "adopt dog OR adopt cat OR animal shelter OR rescue organization",
  lost: "lost dog OR lost pet OR found dog OR found pet",
  food: "dog food recall OR best dog food OR cat food advice",
  groomer: "dog groomer OR pet grooming",
  training: "dog training OR puppy classes OR obedience training",
  fleas: "flea treatment OR tick prevention",
  ticks: "tick removal OR lyme disease dogs",
  anxiety: "dog separation anxiety OR dog noise anxiety",
  "day out": "dog day out program OR shelter volunteer dog walking", // For "dog day out"
  volunteer: "animal shelter volunteer OR dog walking volunteer",
};

const generalPetSubreddits = [
  "pets", "dogs", "cats", "AskVet", "animalrescue", 
  "sandiego_pets", "aww", "DogAdvice", "CatAdvice" 
  // Add more relevant general pet subreddits if needed
];

function getSearchKeywords(query: string): string {
  const qLower = query.toLowerCase();
  for (const keyword in redditKeywords) {
    if (qLower.includes(keyword)) {
      console.log(`[API /reddit-context] Mapped query "${query}" to Reddit keywords: "${redditKeywords[keyword]}"`);
      return redditKeywords[keyword];
    }
  }
  // Fallback: extract significant words if no direct keyword match
  const words = query.replace(/[^\w\s]/gi, '').split(' ').filter(w => w.length > 3 && !['what', 'where', 'does', 'find', 'looking', 'about', 'your', 'recommendations', 'with', 'from', 'this', 'that', 'have', 'been'].includes(w.toLowerCase()));
  if (words.length > 0 && words.length <= 4) {
    const extracted = words.join(' OR ');
    console.log(`[API /reddit-context] Extracted keywords from query "${query}": "${extracted}"`);
    return extracted;
  }
  if (words.length > 4) {
    const extracted = words.slice(0, 4).join(' OR ');
     console.log(`[API /reddit-context] Extracted keywords (first 4) from query "${query}": "${extracted}"`);
    return extracted;
  }
  console.log(`[API /reddit-context] Defaulting to original query for Reddit search (keywords): "${query}"`);
  return query; // Default to original query if no keywords are found or extracted
}

function summarizePosts(posts: RedditPost[], sourceLabel: string, originalQueryForContext: string, maxLength: number = 450): string {
  if (!posts || posts.length === 0) {
    console.log(`[API /reddit-context] summarizePosts: No posts array or empty array from ${sourceLabel}.`);
    // Return a message indicating no results for this specific source and query
    return `No specific discussions found on ${sourceLabel} for this topic recently.`;
  }

  // Simplified header, original query is already known by the Assistant
  let summaryHeader = `Context from ${sourceLabel} regarding your query:\n`;
  let summarizedContent = "";
  let postsIncludedCount = 0;

  for (const post of posts) {
    if (post.selftext?.toLowerCase().includes('[removed]') || post.selftext?.toLowerCase().includes('[deleted]')) {
        console.log(`[API /reddit-context] summarizePosts: Skipping post "${post.title}" from ${sourceLabel} due to [removed] or [deleted] selftext.`);
        continue;
    }

    let postItemText = `- "${post.title}"`;
    
    // Try to include a snippet of selftext if it's substantial and distinct
    const selftextSnippetMaxLength = 250; // Max length for selftext snippet
    if (post.selftext && post.selftext.trim() !== "" && 
        post.selftext.length > 20 && // Only add if snippet is somewhat substantial
        !post.title.toLowerCase().includes(post.selftext.substring(0, Math.min(20, post.selftext.length)).toLowerCase()) && 
        !post.selftext.toLowerCase().startsWith(post.title.toLowerCase().substring(0, Math.min(20, post.title.length))) 
       ) {
      const snippet = post.selftext.substring(0, selftextSnippetMaxLength).replace(/\n+/g, ' ').trim(); 
      postItemText += ` (User said: ${snippet}${post.selftext.length > selftextSnippetMaxLength ? "..." : ""})`;
      console.log(`[API /reddit-context] summarizePosts: Including selftext snippet for "${post.title}" from ${sourceLabel}. Snippet: ${snippet.substring(0,50)}...`);
    } else {
      // console.log(`[API /reddit-context] summarizePosts: Not including selftext for "${post.title}" from ${sourceLabel} (empty, too short, or too similar to title). Selftext preview: ${post.selftext?.substring(0,30)}`);
    }
    postItemText += ` (Score: ${post.score})\n`;
    
    if (summaryHeader.length + summarizedContent.length + postItemText.length > maxLength) {
      if (postsIncludedCount === 0 && (summaryHeader.length + postItemText.length <= maxLength) ) { 
        summarizedContent += postItemText;
        postsIncludedCount++;
      }
      console.log(`[API /reddit-context] summarizePosts: Max length reached for ${sourceLabel}. Included ${postsIncludedCount} posts.`);
      break; 
    }
    summarizedContent += postItemText;
    postsIncludedCount++;
  }

  if (postsIncludedCount === 0 || summarizedContent.trim() === "") {
     console.log(`[API /reddit-context] summarizePosts: After processing, no suitable content from posts from ${sourceLabel}.`);
     return `Could not extract a concise summary from ${sourceLabel} for this topic.`;
  }
  console.log(`[API /reddit-context] summarizePosts: Successfully summarized ${postsIncludedCount} posts from ${sourceLabel}. Summary length: ${summarizedContent.length}`);
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
  let sanDiegoSummary = "";
  let sanDiegoSource: "r/sandiego" | "none" = "none";

  // 1. Attempt search on r/sandiego
  console.log(`[API /reddit-context] Attempting search on r/sandiego for keywords: "${redditSearchQuery}" (limit 7)`);
  try {
    const sanDiegoPosts = await searchReddit(redditSearchQuery, undefined, 7, 'relevance', 'year', 'sandiego');
    console.log(`[API /reddit-context] Raw Reddit Posts from r/sandiego for keywords "${redditSearchQuery}":`, sanDiegoPosts.length > 0 ? sanDiegoPosts.slice(0,2).map(p=>({title:p.title, score:p.score, selftext_preview: p.selftext?.substring(0,50)})) : "No posts found or error in fetching.");
    sanDiegoSummary = summarizePosts(sanDiegoPosts, 'r/sandiego', originalQuery);
    if (!sanDiegoSummary.includes("No specific discussions found") && !sanDiegoSummary.includes("Could not extract a concise summary")) {
      sanDiegoSource = "r/sandiego";
    }
    console.log(`[API /reddit-context] Summarized r/sandiego context: "${sanDiegoSummary.substring(0,100)}..."`);
  } catch (error: any) {
    console.error(`[API /reddit-context] Error searching r/sandiego:`, error.message);
    sanDiegoSummary = `Error fetching context from r/sandiego: ${error.message.substring(0,100)}`;
  }

  // 2. If r/sandiego search yields no specific results, try general Reddit search
  if (sanDiegoSource === "none" || sanDiegoSummary.includes("No specific discussions found") || sanDiegoSummary.includes("Could not extract a concise summary")) {
    console.log(`[API /reddit-context] r/sandiego search yielded few/no results for query related to "${originalQuery}". Attempting general Reddit search with keywords: "${redditSearchQuery}" (limit 5)`);
    try {
      const generalPosts = await searchReddit(redditSearchQuery, generalPetSubreddits, 5, 'relevance', 'month'); // Search within generalPetSubreddits
      console.log(`[API /reddit-context] Raw Reddit Posts from general search for keywords "${redditSearchQuery}":`, generalPosts.length > 0 ? generalPosts.slice(0,2).map(p=>({title:p.title, score:p.score, selftext_preview:p.selftext?.substring(0,50)})) : "No posts found or error in fetching.");
      const generalSummary = summarizePosts(generalPosts, 'general Reddit community discussions', originalQuery);
      console.log(`[API /reddit-context] Summarized general Reddit context: "${generalSummary.substring(0,100)}..."`);

      if (!generalSummary.includes("No specific discussions found") && !generalSummary.includes("Could not extract a concise summary")) {
        console.log(`[API /reddit-context] Final Reddit Context for original query "${originalQuery}": (Source: general_reddit) ${generalSummary.substring(0,100)}...`);
        return NextResponse.json({ redditContext: generalSummary, source: 'general_reddit' });
      } else {
         // If general search also yields no specific results, return the (likely "no results") San Diego summary or a generic message.
        const fallbackMessage = `Could not find specific community discussions for "${originalQuery}" on Reddit recently.`;
        console.log(`[API /reddit-context] Both r/sandiego and general Reddit search yielded no specific results for query related to "${originalQuery}". Returning: ${fallbackMessage}`);
        return NextResponse.json({ redditContext: sanDiegoSummary.includes("No specific discussions found") ? fallbackMessage : sanDiegoSummary, source: 'none' });
      }
    } catch (error: any) {
      console.error(`[API /reddit-context] Error during general Reddit search:`, error.message);
      const errorMessage = `Error fetching general Reddit context: ${error.message.substring(0,100)}`;
      return NextResponse.json({ redditContext: errorMessage, source: 'none' }, { status: 500 });
    }
  } else {
    // If r/sandiego search was successful, return its summary
    console.log(`[API /reddit-context] Final Reddit Context for original query "${originalQuery}": (Source: r/sandiego) ${sanDiegoSummary.substring(0,100)}...`);
    return NextResponse.json({ redditContext: sanDiegoSummary, source: 'r/sandiego' });
  }
}
