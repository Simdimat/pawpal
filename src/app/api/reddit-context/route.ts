
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, type RedditPost } from '@/services/reddit';

function summarizePosts(posts: RedditPost[], maxLength: number = 400): string { // Increased maxLength slightly
  if (!posts || posts.length === 0) {
    return "No specific discussions found on r/sandiego for this topic recently.";
  }

  let summary = "Here's what some people are saying on r/sandiego:\n";
  let currentLength = summary.length;

  for (const post of posts) {
    let postContent = `- "${post.title}"`;
    if (post.selftext && post.selftext.length < 120 && post.selftext.trim() !== "" && post.selftext.trim() !== "[removed]" && post.selftext.trim() !== "[deleted]") { // Increased selftext length, added checks
      postContent += ` (User said: ${post.selftext.substring(0, 70).replace(/\n/g, ' ')}...)`;
    }
    postContent += ` (Score: ${post.score})\n`;
    
    if (currentLength + postContent.length > maxLength) {
      break; 
    }
    summary += postContent;
    currentLength += postContent.length;
  }
  if (posts.length > 0 && summary === "Here's what some people are saying on r/sandiego:\n") {
    // This means no post content was added to the summary, perhaps titles were too long or selftext filtered.
    // Provide a more generic fallback based on the fact that *some* posts were found.
     console.log('[API /reddit-context] SummarizePosts: No specific content added to summary from posts, returning generic found message.');
    return `Found some discussions on r/sandiego related to "${posts[0].title.substring(0,50)}...". General topics often include experiences and local advice.`;
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

  try {
    const posts = await searchReddit(
      query,
      undefined, 
      10, // Increased limit to fetch more posts
      'relevance', 
      'year',
      'sandiego' 
    );
    console.log(`[API /reddit-context] Raw Reddit Posts for query "${query}":`, JSON.stringify(posts.map(p => ({title: p.title, score: p.score, selftext_preview: p.selftext?.substring(0,50)})), null, 2));
    
    const redditContext = summarizePosts(posts);
    console.log(`[API /reddit-context] Summarized Reddit Context for query "${query}":`, redditContext);
    
    return NextResponse.json({ redditContext });
  } catch (error: any) {
    console.error(`[API /reddit-context] Error fetching Reddit context for r/sandiego, query "${query}":`, error.message);
    return NextResponse.json({ redditContext: "Could not fetch specific Reddit context from r/sandiego at this time due to an error." }, { status: 200 }); // Return 200 so chat can proceed
  }
}
