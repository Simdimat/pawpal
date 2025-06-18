
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, fetchPostComments, type RedditPost, type RedditComment } from '@/services/reddit';

// Restore the original logic for fetching and summarizing Reddit context

const sanDiegoSubreddits = ["sandiego", "sandiego_pets"]; // Example San Diego specific subreddits
const generalPetSubreddits = [
  "pets", "dogs", "cats", "AskVet", "animalrescue", 
  "DogAdvice", "CatAdvice"
  // Removed "aww" as it might be too broad/less relevant for specific advice
];

interface EnhancedRedditPost {
  post: RedditPost;
  comments: RedditComment[];
  sourceType: 'sandiego' | 'general';
}

// Helper to get more targeted keywords from the user query
function getSearchKeywords(query: string): string {
  const qLower = query.toLowerCase();
  // Simple keyword extraction, can be expanded
  if (qLower.includes("skunk")) return "skunk dog advice OR dog skunk spray remedy";
  if (qLower.includes("vet") && qLower.includes("tijuana")) return "tijuana vet review OR tj vet experience";
  if (qLower.includes("vet") || qLower.includes("veterinarian")) return "vet recommendation OR emergency vet OR best san diego veterinarian";
  if (qLower.includes("dog park") || qLower.includes("dog beach")) return "dog park OR dog friendly beach san diego";
  if (qLower.includes("adopt") || qLower.includes("shelter")) return "animal shelter OR dog adoption san diego OR cat adoption";
  if (qLower.includes("lost pet") || qLower.includes("found pet")) return "lost pet san diego OR found dog OR found cat san diego";
  if (qLower.includes("pet emergency") || qLower.includes("urgent pet care")) return "pet emergency san diego OR urgent vet care";
  
  // Fallback to a cleaned up version of the original query if no specific keywords match
  return query.replace(/[^a-zA-Z0-9\s]/g, "").trim();
}


// Helper to summarize posts and their top comments
function summarizePostsWithComments(enhancedPosts: EnhancedRedditPost[], sourceLabel: string, originalQuery: string, maxTotalLength: number = 700): string {
  if (!enhancedPosts || enhancedPosts.length === 0) {
    return `No specific discussions found on ${sourceLabel} relevant to "${originalQuery}".`;
  }

  let summary = `Based on discussions from ${sourceLabel} related to "${originalQuery}":\n`;
  let currentLength = summary.length;

  for (const { post, comments, sourceType } of enhancedPosts) {
    let postSummary = `\nPost: "${post.title}" (Score: ${post.score}, Subreddit: r/${post.subreddit})\n`;
    if (post.selftext && post.selftext.length < 150 && post.selftext !== "[deleted]" && post.selftext !== "[removed]") {
      postSummary += `  Details: ${post.selftext.substring(0, 100).trim()}...\n`;
    }

    if (comments.length > 0) {
      postSummary += `  Key Comments:\n`;
      const commentsToInclude = Math.min(comments.length, 2); // Max 2 comments per post for brevity
      for (let i = 0; i < commentsToInclude; i++) {
        const comment = comments[i];
        if (comment.body && comment.body !== "[deleted]" && comment.body !== "[removed]") {
           const commentText = `    - "${comment.body.substring(0, 100).trim()}${comment.body.length > 100 ? '...' : ''}" (Score: ${comment.score})\n`;
           if (currentLength + postSummary.length + commentText.length <= maxTotalLength) {
            postSummary += commentText;
           } else break; // Stop adding comments if exceeding length
        }
      }
    }
    
    if (currentLength + postSummary.length <= maxTotalLength) {
        summary += postSummary;
        currentLength += postSummary.length;
    } else {
        break; // Stop adding posts if exceeding length
    }
  }
  if (summary.length > maxTotalLength) {
    summary = summary.substring(0, maxTotalLength - 3) + "...";
  }
  return summary.trim();
}


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  
  console.log(`[API /reddit-context ORIGINAL] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    console.log('[API /reddit-context ORIGINAL] Original query parameter is missing.');
    return NextResponse.json({ redditContext: 'Query parameter is required for Reddit context.', source: 'none' }, { status: 400 });
  }

  try {
    const keywords = getSearchKeywords(originalQuery);
    console.log(`[API /reddit-context ORIGINAL] Using keywords: "${keywords}"`);

    let allEnhancedPosts: EnhancedRedditPost[] = [];
    let sourceUsed: 'r/sandiego' | 'general_reddit' | 'none' = 'none';

    // 1. Search San Diego specific subreddits
    const sdPosts = await searchReddit(keywords, sanDiegoSubreddits, 2, 'relevance', 'year');
    console.log(`[API /reddit-context ORIGINAL] Found ${sdPosts.length} posts from San Diego subreddits.`);
    for (const post of sdPosts) {
      if (post.num_comments > 0) {
        const comments = await fetchPostComments(post.name, 2); // post.name is the fullname
        allEnhancedPosts.push({ post, comments, sourceType: 'sandiego' });
      } else {
        allEnhancedPosts.push({ post, comments: [], sourceType: 'sandiego' });
      }
    }

    // 2. If not enough from SD, or for broader topics, search general pet subreddits
    if (allEnhancedPosts.length < 2) { // Fetch more if SD results are sparse
      const generalPosts = await searchReddit(keywords, generalPetSubreddits, 3 - allEnhancedPosts.length, 'relevance', 'year');
      console.log(`[API /reddit-context ORIGINAL] Found ${generalPosts.length} posts from general subreddits.`);
      for (const post of generalPosts) {
         if (post.num_comments > 0) {
            const comments = await fetchPostComments(post.name, 2);
            allEnhancedPosts.push({ post, comments, sourceType: 'general' });
         } else {
            allEnhancedPosts.push({ post, comments: [], sourceType: 'general' });
         }
      }
    }
    
    // Sort by relevance (post score as a proxy, can be more complex)
    allEnhancedPosts.sort((a, b) => b.post.score - a.post.score);
    const topEnhancedPosts = allEnhancedPosts.slice(0, 2); // Limit to top 2 overall for context

    let redditContextSummary = `No relevant Reddit discussions found for "${originalQuery}".`;
    
    if (topEnhancedPosts.length > 0) {
      // Determine primary source type for labeling
      const primarySourceType = topEnhancedPosts[0].sourceType;
      sourceUsed = primarySourceType === 'sandiego' ? 'r/sandiego' : 'general_reddit';
      redditContextSummary = summarizePostsWithComments(topEnhancedPosts, primarySourceType === 'sandiego' ? "San Diego Reddit" : "General Reddit", originalQuery);
      console.log(`[API /reddit-context ORIGINAL] Summarized context (Source: ${sourceUsed}): ${redditContextSummary.substring(0, 100)}...`);
    } else {
      console.log(`[API /reddit-context ORIGINAL] No posts found after fetching comments and filtering.`);
      sourceUsed = 'none';
    }
    
    return NextResponse.json({ redditContext: redditContextSummary, source: sourceUsed });

  } catch (error: any) {
    console.error(`[API /reddit-context ORIGINAL] Error processing request:`, error.message, error.stack);
    return NextResponse.json({ 
      redditContext: `Error fetching Reddit context: ${error.message ? error.message.substring(0,100) : 'Unknown error'}.`, 
      source: 'none' 
    }, { status: 500 });
  }
}
