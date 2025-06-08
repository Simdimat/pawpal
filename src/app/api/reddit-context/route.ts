
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, type RedditPost } from '@/services/reddit';

function summarizePosts(posts: RedditPost[], maxLength: number = 350): string { // Increased length slightly
  if (!posts || posts.length === 0) {
    return "No specific discussions found on r/sandiego for this topic recently.";
  }

  let summary = "Here's what some people are saying on r/sandiego:\n";
  let currentLength = summary.length;

  for (const post of posts) {
    let postContent = `- "${post.title}"`;
    if (post.selftext && post.selftext.length < 100 && post.selftext.trim() !== "") { // Add short selftext if available
      postContent += ` (User said: ${post.selftext.substring(0, 50).replace(/\n/g, ' ')}...)`;
    }
    postContent += ` (Score: ${post.score})\n`;
    
    if (currentLength + postContent.length > maxLength) {
      break; 
    }
    summary += postContent;
    currentLength += postContent.length;
  }
  if (posts.length > 0 && summary === "Here's what some people are saying on r/sandiego:\n") {
    return `Found some relevant discussions on r/sandiego for "${posts[0].subreddit}", typically focusing on topics like "${posts[0].title.substring(0,50)}...".`;
  }
  return summary.trim();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    // Always search r/sandiego
    const posts = await searchReddit(
      query,
      undefined, // No need for the subreddits array here as primarySubreddit is used
      3, 
      'relevance', 
      'year',
      'sandiego' // Target r/sandiego specifically
    );
    const redditContext = summarizePosts(posts);
    
    return NextResponse.json({ redditContext });
  } catch (error) {
    console.error('Error fetching Reddit context from r/sandiego:', error);
    return NextResponse.json({ redditContext: "Could not fetch specific Reddit context from r/sandiego at this time." }, { status: 200 });
  }
}
