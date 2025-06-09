
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, fetchPostComments, type RedditPost, type RedditComment } from '@/services/reddit';

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
  "day out": "dog day out program OR shelter volunteer dog walking",
  volunteer: "animal shelter volunteer OR dog walking volunteer",
};

const generalPetSubreddits = [
  "pets", "dogs", "cats", "AskVet", "animalrescue", 
  "sandiego_pets", "aww", "DogAdvice", "CatAdvice"
];

interface EnhancedRedditPost {
  post: RedditPost;
  comments: RedditComment[];
}

function getSearchKeywords(query: string): string {
  const qLower = query.toLowerCase();
  for (const keyword in redditKeywords) {
    if (qLower.includes(keyword)) {
      console.log(`[API /reddit-context] Mapped query "${query}" to Reddit keywords: "${redditKeywords[keyword]}"`);
      return redditKeywords[keyword];
    }
  }
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
  return query;
}

function summarizePostsWithComments(enhancedPosts: EnhancedRedditPost[], sourceLabel: string, originalQuery: string, maxTotalLength: number = 700): string {
  if (!enhancedPosts || enhancedPosts.length === 0) {
    console.log(`[API /reddit-context] summarizePostsWithComments: No enhanced posts array or empty array from ${sourceLabel}.`);
    return `No specific discussions or comments found on ${sourceLabel} for this topic recently.`;
  }

  let summaryHeader = `Context from ${sourceLabel} regarding your query:\n`;
  let summarizedContent = "";
  let postsIncludedCount = 0;
  const MAX_COMMENTS_PER_POST = 2;
  const MAX_COMMENT_SNIPPET_LENGTH = 100;

  for (const { post, comments } of enhancedPosts) {
    if (post.selftext?.toLowerCase().includes('[removed]') || post.selftext?.toLowerCase().includes('[deleted]')) {
      console.log(`[API /reddit-context] summarizePostsWithComments: Skipping post "${post.title}" from ${sourceLabel} due to [removed] or [deleted] selftext.`);
      continue;
    }

    let postItemText = `- Post: "${post.title}" (Score: ${post.score})\n`;
    
    const selftextSnippetMaxLength = 150; 
    if (post.selftext && post.selftext.trim() !== "" && 
        post.selftext.length > 20 && 
        !post.title.toLowerCase().includes(post.selftext.substring(0, Math.min(20, post.selftext.length)).toLowerCase()) && 
        !post.selftext.toLowerCase().startsWith(post.title.toLowerCase().substring(0, Math.min(20, post.title.length))) 
       ) {
      const snippet = post.selftext.substring(0, selftextSnippetMaxLength).replace(/\n+/g, ' ').trim(); 
      postItemText += `  Body: ${snippet}${post.selftext.length > selftextSnippetMaxLength ? "..." : ""}\n`;
    }

    if (comments && comments.length > 0) {
      postItemText += `  Top Comments:\n`;
      comments.slice(0, MAX_COMMENTS_PER_POST).forEach(comment => {
        const commentSnippet = comment.body.substring(0, MAX_COMMENT_SNIPPET_LENGTH).replace(/\n+/g, ' ').trim();
        postItemText += `    - User ${comment.author}: "${commentSnippet}${comment.body.length > MAX_COMMENT_SNIPPET_LENGTH ? "..." : ""}" (Score: ${comment.score})\n`;
      });
    }
    postItemText += "\n"; // Add a newline after each post's summary
    
    if (summaryHeader.length + summarizedContent.length + postItemText.length > maxTotalLength) {
      if (postsIncludedCount === 0 && (summaryHeader.length + postItemText.length <= maxTotalLength) ) { 
        summarizedContent += postItemText;
        postsIncludedCount++;
      }
      console.log(`[API /reddit-context] summarizePostsWithComments: Max length reached for ${sourceLabel}. Included ${postsIncludedCount} posts.`);
      break; 
    }
    summarizedContent += postItemText;
    postsIncludedCount++;
  }

  if (postsIncludedCount === 0 || summarizedContent.trim() === "") {
     console.log(`[API /reddit-context] summarizePostsWithComments: After processing, no suitable content from posts/comments from ${sourceLabel}.`);
     return `Could not extract a concise summary from ${sourceLabel} for this topic, including comments.`;
  }
  console.log(`[API /reddit-context] summarizePostsWithComments: Successfully summarized ${postsIncludedCount} posts (with comments) from ${sourceLabel}. Summary length: ${summarizedContent.length}`);
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
  let finalSummary = "";
  let finalSource: "r/sandiego" | "general_reddit" | "none" = "none";
  const MAX_POSTS_TO_PROCESS_COMMENTS_FOR = 2; // Fetch comments for top 2 posts
  const COMMENTS_PER_POST_LIMIT = 2; // Fetch top 2 comments per post

  // 1. Attempt search on r/sandiego
  console.log(`[API /reddit-context] Attempting search on r/sandiego for keywords: "${redditSearchQuery}" (limit 7)`);
  try {
    const sanDiegoRawPosts = await searchReddit(redditSearchQuery, undefined, 7, 'relevance', 'year', 'sandiego');
    console.log(`[API /reddit-context] Raw Reddit Posts from r/sandiego for keywords "${redditSearchQuery}":`, sanDiegoRawPosts.length > 0 ? sanDiegoRawPosts.slice(0,2).map(p=>({title:p.title, score:p.score, selftext_preview: p.selftext?.substring(0,50), name: p.name })) : "No posts found or error in fetching.");
    
    const sanDiegoEnhancedPosts: EnhancedRedditPost[] = [];
    if (sanDiegoRawPosts.length > 0) {
      for (const post of sanDiegoRawPosts.slice(0, MAX_POSTS_TO_PROCESS_COMMENTS_FOR)) {
        if (post.name) { // Ensure post.name (fullname) is available
          const comments = await fetchPostComments(post.name, COMMENTS_PER_POST_LIMIT);
          sanDiegoEnhancedPosts.push({ post, comments });
        } else {
          console.warn(`[API /reddit-context] Post with title "${post.title}" missing 'name' (fullname), cannot fetch comments.`);
          sanDiegoEnhancedPosts.push({ post, comments: [] }); // Add post without comments if name is missing
        }
      }
    }
    
    finalSummary = summarizePostsWithComments(sanDiegoEnhancedPosts, 'r/sandiego', originalQuery);
    if (!finalSummary.includes("No specific discussions or comments found") && !finalSummary.includes("Could not extract a concise summary")) {
      finalSource = "r/sandiego";
    }
    console.log(`[API /reddit-context] Summarized r/sandiego context (with comments): "${finalSummary.substring(0,100)}..."`);
  } catch (error: any) {
    console.error(`[API /reddit-context] Error searching r/sandiego or its comments:`, error.message);
    finalSummary = `Error fetching context from r/sandiego: ${error.message.substring(0,100)}`;
  }

  // 2. If r/sandiego search yields no specific results, try general Reddit search
  if (finalSource === "none" || finalSummary.includes("No specific discussions or comments found") || finalSummary.includes("Could not extract a concise summary")) {
    console.log(`[API /reddit-context] r/sandiego search yielded few/no results for query related to "${originalQuery}". Attempting general Reddit search with keywords: "${redditSearchQuery}" (limit 5)`);
    try {
      const generalRawPosts = await searchReddit(redditSearchQuery, generalPetSubreddits, 5, 'relevance', 'month');
      console.log(`[API /reddit-context] Raw Reddit Posts from general search for keywords "${redditSearchQuery}":`, generalRawPosts.length > 0 ? generalRawPosts.slice(0,2).map(p=>({title:p.title, score:p.score, selftext_preview:p.selftext?.substring(0,50), name: p.name })) : "No posts found or error in fetching.");

      const generalEnhancedPosts: EnhancedRedditPost[] = [];
      if (generalRawPosts.length > 0) {
        for (const post of generalRawPosts.slice(0, MAX_POSTS_TO_PROCESS_COMMENTS_FOR)) {
           if (post.name) { // Ensure post.name (fullname) is available
            const comments = await fetchPostComments(post.name, COMMENTS_PER_POST_LIMIT);
            generalEnhancedPosts.push({ post, comments });
          } else {
            console.warn(`[API /reddit-context] Post with title "${post.title}" missing 'name' (fullname), cannot fetch comments.`);
            generalEnhancedPosts.push({ post, comments: [] });
          }
        }
      }
      
      const generalSummary = summarizePostsWithComments(generalEnhancedPosts, 'general Reddit community discussions', originalQuery);
      console.log(`[API /reddit-context] Summarized general Reddit context (with comments): "${generalSummary.substring(0,100)}..."`);

      if (!generalSummary.includes("No specific discussions or comments found") && !generalSummary.includes("Could not extract a concise summary")) {
        finalSummary = generalSummary;
        finalSource = "general_reddit";
      } else {
        const fallbackMessage = `Could not find specific community discussions (including comments) for "${originalQuery}" on Reddit recently.`;
        finalSummary = finalSummary.includes("No specific discussions or comments found") ? fallbackMessage : finalSummary; // Keep original error if it was more specific
      }
    } catch (error: any) {
      console.error(`[API /reddit-context] Error during general Reddit search or its comments:`, error.message);
      const errorMessage = `Error fetching general Reddit context: ${error.message.substring(0,100)}`;
      finalSummary = errorMessage; // Overwrite with error message if general search fails critically
      finalSource = "none";
    }
  }
  
  console.log(`[API /reddit-context] Final Reddit Context for original query "${originalQuery}": (Source: ${finalSource}) ${finalSummary.substring(0,100)}...`);
  return NextResponse.json({ redditContext: finalSummary, source: finalSource });
}

