
import { NextRequest, NextResponse } from 'next/server';
// import { searchReddit, fetchPostComments, type RedditPost, type RedditComment } from '@/services/reddit'; // Original direct Reddit service
import { searchAndFetchFullRedditPosts } from '@/services/experimental_reddit'; // Experimental service

// const sanDiegoSubreddits = ["sandiego", "sandiego_pets"];
// const generalPetSubreddits = [
//   "pets", "dogs", "cats", "AskVet", "animalrescue", 
//   "DogAdvice", "CatAdvice"
// ];

// interface EnhancedRedditPost {
//   post: RedditPost;
//   comments: RedditComment[];
//   sourceType: 'sandiego' | 'general';
// }

// function getSearchKeywords(query: string): string {
//   const qLower = query.toLowerCase();
//   if (qLower.includes("skunk")) return "skunk dog advice OR dog skunk spray remedy";
//   if (qLower.includes("vet") && qLower.includes("tijuana")) return "tijuana vet review OR tj vet experience";
//   if (qLower.includes("vet") || qLower.includes("veterinarian")) return "vet recommendation OR emergency vet OR best san diego veterinarian";
//   if (qLower.includes("dog park") || qLower.includes("dog beach")) return "dog park OR dog friendly beach san diego";
//   if (qLower.includes("adopt") || qLower.includes("shelter")) return "animal shelter OR dog adoption san diego OR cat adoption";
//   if (qLower.includes("lost pet") || qLower.includes("found pet")) return "lost pet san diego OR found dog OR found cat san diego";
//   if (qLower.includes("pet emergency") || qLower.includes("urgent pet care")) return "pet emergency san diego OR urgent vet care";
//   return query.replace(/[^a-zA-Z0-9\\s]/g, "").trim();
// }

// function summarizePostsWithComments(enhancedPosts: EnhancedRedditPost[], sourceLabel: string, originalQuery: string, maxTotalLength: number = 700): string {
//   if (!enhancedPosts || enhancedPosts.length === 0) {
//     return `No specific discussions found on ${sourceLabel} relevant to "${originalQuery}".`;
//   }
//   let summary = `Based on discussions from ${sourceLabel} related to "${originalQuery}":\n`;
//   let currentLength = summary.length;
//   for (const { post, comments, sourceType } of enhancedPosts) {
//     let postSummary = `\nPost: "${post.title}" (Score: ${post.score}, Subreddit: r/${post.subreddit})\n`;
//     if (post.selftext && post.selftext.length < 150 && post.selftext !== "[deleted]" && post.selftext !== "[removed]") {
//       postSummary += `  Details: ${post.selftext.substring(0, 100).trim()}...\n`;
//     }
//     if (comments.length > 0) {
//       postSummary += `  Key Comments:\n`;
//       const commentsToInclude = Math.min(comments.length, 2);
//       for (let i = 0; i < commentsToInclude; i++) {
//         const comment = comments[i];
//         if (comment.body && comment.body !== "[deleted]" && comment.body !== "[removed]") {
//            const commentText = `    - "${comment.body.substring(0, 100).trim()}${comment.body.length > 100 ? '...' : ''}" (Score: ${comment.score})\n`;
//            if (currentLength + postSummary.length + commentText.length <= maxTotalLength) {
//             postSummary += commentText;
//            } else break;
//         }
//       }
//     }
//     if (currentLength + postSummary.length <= maxTotalLength) {
//         summary += postSummary;
//         currentLength += postSummary.length;
//     } else {
//         break;
//     }
//   }
//   if (summary.length > maxTotalLength) {
//     summary = summary.substring(0, maxTotalLength - 3) + "...";
//   }
//   return summary.trim();
// }


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  
  console.log(`[API /reddit-context EXPERIMENTAL] Received GET request for original query: "${originalQuery}"`);

  if (!originalQuery) {
    console.log('[API /reddit-context EXPERIMENTAL] Original query parameter is missing.');
    return NextResponse.json({ redditContext: 'Query parameter is required for Reddit context.', source: 'none' }, { status: 400 });
  }

  try {
    const experimentalContext = await searchAndFetchFullRedditPosts(originalQuery, 2); // Fetch 2 posts and their comments
    
    let sourceUsed: 'experimental_google_reddit' | 'none' = 'none';
    if (experimentalContext && !experimentalContext.startsWith("No relevant Reddit discussions found") && !experimentalContext.startsWith("Sorry, I encountered an error")) {
        sourceUsed = 'experimental_google_reddit';
    }
    
    console.log(`[API /reddit-context EXPERIMENTAL] Context from experimental service (Source: ${sourceUsed}): ${experimentalContext.substring(0, 150)}...`);
    
    return NextResponse.json({ redditContext: experimentalContext, source: sourceUsed });

  } catch (error: any) {
    console.error(`[API /reddit-context EXPERIMENTAL] Error processing request:`, error.message, error.stack);
    return NextResponse.json({ 
      redditContext: `Error fetching experimental Reddit context: ${error.message ? error.message.substring(0,100) : 'Unknown error'}.`, 
      source: 'none' 
    }, { status: 500 });
  }
}
