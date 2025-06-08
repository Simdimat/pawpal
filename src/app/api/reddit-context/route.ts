
import { NextRequest, NextResponse } from 'next/server';
import { searchReddit, type RedditPost } from '@/services/reddit';

function summarizePosts(posts: RedditPost[], maxLength: number = 300): string {
  if (!posts || posts.length === 0) {
    return "No specific discussions found on Reddit for this topic recently.";
  }

  let summary = "Here's what some people are saying on Reddit:\n";
  let currentLength = summary.length;

  for (const post of posts) {
    let postContent = `- "${post.title}"`;
    if (post.selftext && post.selftext.length < 100) { // Add short selftext
      postContent += ` (User said: ${post.selftext.substring(0, 50)}...)`;
    }
    postContent += ` (Score: ${post.score})\n`;
    
    if (currentLength + postContent.length > maxLength) {
      break; 
    }
    summary += postContent;
    currentLength += postContent.length;
  }
  if (posts.length > 0 && summary === "Here's what some people are saying on Reddit:\n") {
    // Fallback if all posts were too long to add snippets
    return `Found some relevant discussions on Reddit for "${posts[0].subreddit}", typically focusing on topics like "${posts[0].title.substring(0,50)}...".`;
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
    // Define relevant subreddits based on query, or use a default set
    let subreddits = ['sandiego', 'dogs', 'AskVet', 'Tijuana', 'pets'];
    if (query.toLowerCase().includes('skunk')) {
        subreddits = ['pets', 'dogs', 'AskVet', 'sandiego'];
    } else if (query.toLowerCase().includes('tijuana') && query.toLowerCase().includes('vet')) {
        subreddits = ['Tijuana', 'sandiego', 'pets', 'AskVet'];
    }


    const posts = await searchReddit(query, subreddits, 3, 'relevance', 'year');
    const redditContext = summarizePosts(posts);
    
    return NextResponse.json({ redditContext });
  } catch (error) {
    console.error('Error fetching Reddit context:', error);
    // Return a neutral message if Reddit fetch fails, so chatbot can still proceed
    return NextResponse.json({ redditContext: "Could not fetch specific Reddit context at this time." }, { status: 200 });
  }
}
