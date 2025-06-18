
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, fetchPostComments, type RedditPost, type RedditComment } from '@/services/reddit';

interface RedditContextResponse {
  redditContext: string;
  debugLogs: string[];
  source: 'reddit_direct_search' | 'none';
}

// Helper to extract keywords from a user query
function extractKeywords(query: string): string {
  // Simple keyword extraction: lowercase, remove common words, take first few significant words.
  const commonWords = new Set(['my', 'is', 'a', 'the', 'what', 'do', 'i', 'for', 'in', 'on', 'how', 'to', 'help', 'dog', 'cat', 'pet', 'was', 'got', 'by']);
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/gi, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => !commonWords.has(word) && word.length > 2)
    .slice(0, 5) // Take up to 5 keywords
    .join(' ');
  return keywords || query; // Fallback to original query if no keywords extracted
}

async function getDirectRedditContext(userQuery: string): Promise<RedditContextResponse> {
  const debugLogs: string[] = [];
  debugLogs.push(`[Direct Reddit] Starting context fetch for query: "${userQuery}"`);

  const keywords = extractKeywords(userQuery);
  debugLogs.push(`[Direct Reddit] Extracted keywords: "${keywords}"`);

  const sanDiegoSubreddits = ['sandiego', 'SanDiegoClassifieds', 'sandiego_pets'];
  const generalPetSubreddits = ['dogs', 'cats', 'pets', 'AskVet', 'PetAdvice', 'DogAdvice', 'CatAdvice'];

  let allPosts: RedditPost[] = [];
  let sourceUsed: 'reddit_direct_search' | 'none' = 'none';

  try {
    debugLogs.push(`[Direct Reddit] Searching San Diego subreddits: ${sanDiegoSubreddits.join(', ')} for keywords: "${keywords}"`);
    const { posts: sdPosts, debugLogs: sdSearchLogs } = await searchReddit(keywords, sanDiegoSubreddits, 2, 'relevance', 'year', undefined, true);
    allPosts.push(...sdPosts);
    debugLogs.push(...sdSearchLogs.map(log => `[Direct Reddit - SD Search] ${log}`));

    if (allPosts.length < 2) {
      debugLogs.push(`[Direct Reddit] Not enough results from SD subreddits (${allPosts.length}). Searching general pet subreddits: ${generalPetSubreddits.join(', ')} for keywords: "${keywords}"`);
      const { posts: generalPosts, debugLogs: generalSearchLogs } = await searchReddit(keywords, generalPetSubreddits, 2 - allPosts.length, 'relevance', 'year', undefined, true);
      allPosts.push(...generalPosts);
      debugLogs.push(...generalSearchLogs.map(log => `[Direct Reddit - General Search] ${log}`));
    }
    
    allPosts = Array.from(new Map(allPosts.map(post => [post.id, post])).values());
    debugLogs.push(`[Direct Reddit] Total unique posts found after primary targeted searches: ${allPosts.length}`);

    if (allPosts.length === 0) {
      debugLogs.push(`[Direct Reddit] No posts found after targeted searches. Attempting broader search across all Reddit for keywords: "${keywords}"`);
      const { posts: broaderPosts, debugLogs: broaderSearchLogs } = await searchReddit(keywords, undefined, 2, 'relevance', 'year', undefined, false);
      allPosts.push(...broaderPosts); // Add to existing (which is empty here)
      allPosts = Array.from(new Map(allPosts.map(post => [post.id, post])).values()); // Ensure uniqueness again
      debugLogs.push(...broaderSearchLogs.map(log => `[Direct Reddit - Broader Search] ${log}`));
      debugLogs.push(`[Direct Reddit] Total unique posts found after broader search: ${allPosts.length}`);
    }


    if (allPosts.length === 0) {
      debugLogs.push('[Direct Reddit] No relevant Reddit posts found after all search attempts.');
      return { redditContext: 'No relevant Reddit discussions found for your query.', debugLogs, source: 'none' };
    }

    sourceUsed = 'reddit_direct_search';
    let contextSummary = `Based on community discussions on Reddit related to "${userQuery}":\n\n`;
    let commentsFetchedSuccessfullyForAnyPost = false;

    for (const post of allPosts.slice(0, 2)) { // Process top 2 relevant posts
      debugLogs.push(`[Direct Reddit] Processing post: "${post.title}" (ID: ${post.id}, Fullname: ${post.name}) from r/${post.subreddit}`);
      contextSummary += `Post: "${post.title}" (r/${post.subreddit}, Score: ${post.score})\n`;
      if (post.selftext && post.selftext.length > 0 && post.selftext !== '[deleted]' && post.selftext !== '[removed]') {
        contextSummary += `  Content: ${post.selftext.substring(0, 150).trim()}...\n`;
      } else if (post.url && !post.url.includes(post.permalink) && !post.url.includes(post.id)) {
         contextSummary += `  Link: ${post.url}\n`;
      }

      try {
        // Use post.name (fullname like t3_xxxx) for fetching comments
        const { comments, debugLogs: commentFetchLogs } = await fetchPostComments(post.name, 2); 
        debugLogs.push(...commentFetchLogs.map(log => `[Direct Reddit - Comments for ${post.name}] ${log}`));

        if (comments.length > 0) {
          contextSummary += `  Top Comments:\n`;
          comments.forEach(comment => {
            contextSummary += `    - "${comment.body.substring(0, 100).trim()}${comment.body.length > 100 ? '...' : ''}" (Score: ${comment.score})\n`;
          });
          commentsFetchedSuccessfullyForAnyPost = true;
        } else {
          contextSummary += `  No relevant comments found or comments could not be retrieved for this post.\n`;
           debugLogs.push(`[Direct Reddit] No valid comments fetched for post ${post.name}`);
        }
      } catch (commentError: any) {
        const errorMsg = `Error fetching comments for post ${post.name}: ${commentError.message || 'Unknown error'}`;
        debugLogs.push(`[Direct Reddit] ${errorMsg}`);
        contextSummary += `  Could not fetch comments for this post.\n`;
      }
      contextSummary += "\n";
    }

    if (!commentsFetchedSuccessfullyForAnyPost && allPosts.length > 0) {
      debugLogs.push('[Direct Reddit] No comments were successfully fetched for any of the top posts, but posts were found.');
      // contextSummary += "Could not retrieve detailed comments, but found relevant post titles.\n"; 
      // The summary already includes post titles, so this might be redundant.
    }
    
    debugLogs.push(`[Direct Reddit] Final context summary constructed. Length: ${contextSummary.trim().length}`);
    return { redditContext: contextSummary.trim(), debugLogs, source: sourceUsed };

  } catch (error: any) {
    const errorMsg = `[Direct Reddit] General error in getDirectRedditContext: ${error.message}`;
    console.error(errorMsg, error.stack); // Keep server console error
    debugLogs.push(errorMsg);
    if (error.stack) {
        debugLogs.push(`[Direct Reddit] Stack: ${error.stack.substring(0, 200)}...`);
    }
    return {
      redditContext: `Sorry, I encountered an error trying to fetch Reddit content directly: ${error.message.substring(0,100)}`,
      debugLogs,
      source: 'none'
    };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  let allDebugLogs: string[] = [];
  
  allDebugLogs.push(`[API /reddit-context DIRECT] Received GET for query: "${originalQuery}"`);

  if (!originalQuery) {
    allDebugLogs.push('[API /reddit-context DIRECT] Original query parameter is missing.');
    return NextResponse.json({ 
      redditContext: 'Query parameter is required for Reddit context.', 
      debugLogs: allDebugLogs,
      source: 'none' 
    }, { status: 400 });
  }

  try {
    const { redditContext, debugLogs: serviceDebugLogs, source } = await getDirectRedditContext(originalQuery);
    allDebugLogs.push(...serviceDebugLogs);
    
    allDebugLogs.push(`[API /reddit-context DIRECT] Context from direct service (Source: ${source}): ${redditContext.substring(0, 150)}...`);
    
    return NextResponse.json({ redditContext, debugLogs: allDebugLogs, source });

  } catch (error: any) {
    const errorMsg = `[API /reddit-context DIRECT] Outer error processing request: ${error.message}`;
    console.error(errorMsg, error.stack); // Keep server console error
    allDebugLogs.push(errorMsg);
    if (error.stack) {
        allDebugLogs.push(`[API /reddit-context DIRECT] Outer Stack: ${error.stack.substring(0, 200)}...`);
    }
    return NextResponse.json({ 
      redditContext: `Error fetching direct Reddit context (API Level): ${error.message ? error.message.substring(0,100) : 'Unknown error'}.`,
      debugLogs: allDebugLogs,
      source: 'none' 
    }, { status: 500 });
  }
}
