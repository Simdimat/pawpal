
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const redditClientId = process.env.REDDIT_CLIENT_ID;
  const redditRedirectUri = process.env.REDDIT_REDIRECT_URI;

  if (!redditClientId || !redditRedirectUri) {
    console.error('Reddit API Client ID or Redirect URI is not configured in .env');
    return NextResponse.json({ error: 'Reddit API credentials missing in server configuration. Please check .env file.' }, { status: 500 });
  }

  // In a production application, the 'state' parameter should be a unique, unguessable string
  // that is generated and stored (e.g., in a short-lived cookie or session) before redirecting.
  // It should then be verified in the callback to prevent CSRF attacks.
  const state = 'randomstring123'; 

  const params = new URLSearchParams({
    client_id: redditClientId,
    response_type: 'code',
    state: state,
    redirect_uri: redditRedirectUri,
    duration: 'permanent', // Requests a refresh_token for long-term access
    scope: 'identity read mysubreddits', // 'identity' for user info, 'read' for content, 'mysubreddits' (example)
  });

  const authorizationUrl = `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
  return NextResponse.redirect(authorizationUrl);
}
