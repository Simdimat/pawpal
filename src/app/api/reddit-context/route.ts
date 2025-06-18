
import { NextRequest, NextResponse } from 'next/server';
// Import the new experimental service
import { searchRedditViaGoogleAndSummarizeSnippets } from '@/services/experimental_reddit';

// The old import from '@/services/reddit' and related functions (getSearchKeywords, summarizePostsWithComments)
// are effectively replaced by the experimental service for this test.
// They can be commented out or removed if this experiment proves successful long-term.
/*
import { searchReddit, fetchPostComments, type RedditPost, type RedditComment } from '@/services/reddit';

const redditKeywords: Record<string, string> = {
  skunk: "skunk dog experiences OR skunk removal OR dog skunk spray OR skunk odor",
  vet: "vet recommendation OR veterinarian experiences OR emergency vet OR low cost vet",
  // ... other keywords
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
  // ... old implementation
  const qLower = query.toLowerCase();
  for (const keyword in redditKeywords) {
    if (qLower.includes(keyword)) {
      return redditKeywords[keyword];
    }
  }
  return query; // Fallback
}

function summarizePostsWithComments(enhancedPosts: EnhancedRedditPost[], sourceLabel: string, originalQuery: string, maxTotalLength: number = 700): string {
  // ... old implementation
  if (!enhancedPosts || enhancedPosts.length === 0) return \`No specific discussions found on \${sourceLabel}.\`;
  return "Summary from old function.";
}
*/

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalQuery = searchParams.get('query');
  
  console.log(\`[API /reddit-context EXPERIMENTAL] Received GET request for original query: "\${originalQuery}"\`);

  if (!originalQuery) {
    console.log('[API /reddit-context EXPERIMENTAL] Original query parameter is missing.');
    return NextResponse.json({ redditContext: 'Query parameter is required for Reddit context.', source: 'experimental_google_reddit_snippets' }, { status: 400 });
  }

  try {
    // Call the new experimental function to get summarized snippets
    const summaryFromSnippets = await searchRedditViaGoogleAndSummarizeSnippets(originalQuery, 3);
    
    let sourceLabel: "experimental_google_reddit_snippets" | "none" = "none";

    // Determine source based on whether the summary indicates results were found
    if (summaryFromSnippets && 
        !summaryFromSnippets.startsWith("No relevant Reddit discussions found") && 
        !summaryFromSnippets.startsWith("Sorry, I encountered an error") &&
        !summaryFromSnippets.startsWith("Found Google results, but could not extract")) {
      sourceLabel = "experimental_google_reddit_snippets";
    }
    
    console.log(\`[API /reddit-context EXPERIMENTAL] Final Reddit Context for original query "\${originalQuery}": (Source: \${sourceLabel}) \${summaryFromSnippets.substring(0,150)}...\`);
    return NextResponse.json({ redditContext: summaryFromSnippets, source: sourceLabel });

  } catch (error: any) {
    console.error(\`[API /reddit-context EXPERIMENTAL] Error processing request:\`, error.message);
    // Ensure a consistent error response structure
    return NextResponse.json({ 
      redditContext: \`Error fetching experimental Reddit context: \${error.message ? error.message.substring(0,100) : 'Unknown error'}\`, 
      source: 'none' 
    }, { status: 500 });
  }
}
