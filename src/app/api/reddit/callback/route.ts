
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const redditClientId = process.env.REDDIT_CLIENT_ID;
  const redditClientSecret = process.env.REDDIT_CLIENT_SECRET;
  const redditRedirectUri = process.env.REDDIT_REDIRECT_URI;
  const redditUserAgent = process.env.REDDIT_USER_AGENT;

  if (!redditClientId || !redditClientSecret || !redditRedirectUri || !redditUserAgent) {
    console.error('Reddit API credentials are not fully configured in .env');
    return NextResponse.json({ error: 'Reddit API credentials missing in server configuration. Please check .env file.' }, { status: 500 });
  }

  // IMPORTANT: Verify the 'state' parameter here against the value stored before redirect.
  // This is crucial for CSRF protection. For this example, we're using a static check.
  if (state !== 'randomstring123') { 
    console.warn('State parameter mismatch or missing from Reddit callback.');
    // In a production app, this should be a hard error:
    // return NextResponse.json({ error: 'State parameter mismatch. Potential CSRF attempt.' }, { status: 400 });
  }

  if (!code) {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (error) {
      console.error(`Reddit OAuth error on callback: ${error} - ${errorDescription || 'No description provided.'}`);
      return NextResponse.json({ error: `Reddit OAuth error: ${error}`, description: errorDescription }, { status: 400 });
    }
    return NextResponse.json({ error: 'Authorization code not found in Reddit callback.' }, { status: 400 });
  }

  try {
    const basicAuth = Buffer.from(`${redditClientId}:${redditClientSecret}`).toString('base64');

    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': redditUserAgent,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redditRedirectUri,
      }),
    });

    if (!tokenRes.ok) {
      let errorBody = { error: 'Unknown error during token exchange', error_description: tokenRes.statusText };
      try {
        errorBody = await tokenRes.json();
      } catch (e) {
        // Failed to parse error JSON, use defaults
      }
      console.error('Failed to fetch Reddit access token:', tokenRes.status, errorBody);
      return NextResponse.json({ 
        error: `Failed to get access token: ${errorBody.error || tokenRes.statusText}`, 
        description: errorBody.error_description 
      }, { status: tokenRes.status });
    }

    const tokenData = await tokenRes.json();
    // console.log('Reddit Access Token Data:', tokenData); 

    // TODO: Securely store tokenData (access_token, refresh_token, expires_in)
    // For example, associate it with a user in your database (e.g., Supabase or Firebase).
    // Handle token refresh mechanism.

    // For now, just returning the token data. 
    // In a real app, you'd likely redirect the user to their profile page or another part of your app,
    // perhaps setting a session cookie.
    // Example: return NextResponse.redirect(new URL('/dashboard?reddit_auth=success', request.url));
    return NextResponse.json(tokenData);

  } catch (error: any) {
    console.error('Critical error in Reddit callback handler:', error);
    return NextResponse.json({ error: 'Internal server error during Reddit authentication.', details: error.message }, { status: 500 });
  }
}
