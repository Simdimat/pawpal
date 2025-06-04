
import { Buffer } from 'buffer';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb'; // Adjust the path if necessary

  export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const redirect_uri = process.env.REDDIT_REDIRECT_URI as string;
  const redditClientId = process.env.REDDIT_CLIENT_ID;
  const redditClientSecret = process.env.REDDIT_CLIENT_SECRET;
  const redditRedirectUri = process.env.REDDIT_REDIRECT_URI;
  const redditUserAgent = process.env.REDDIT_USER_AGENT;

  if (!redditClientId || !redditClientSecret || !redditRedirectUri || !redditUserAgent) {
    console.error('Reddit API credentials are not fully configured in .env');
    return NextResponse.json({ error: 'Reddit API credentials missing in server configuration. Please check .env file.' }, { status: 500 });
  }

  const state = req.nextUrl.searchParams.get('state'); // Remember to implement CSRF protection for 'state'

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  // Basic state validation (replace with secure CSRF protection)
  // if (state !== 'YOUR_RANDOM_STRING') { // Replace with your actual state validation
  //   return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  // }

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
        grant_type: 'authorization_code', // Corrected grant_type
        code: code,
        redirect_uri: redditRedirectUri,
      }),
    });

    if (!tokenRes.ok) {
      let errorBody;
      try {
        errorBody = await tokenRes.json();
      } catch (e) {
        console.error('Failed to parse Reddit token error response:', e);
        errorBody = { error: 'Unknown error', error_description: tokenRes.statusText };
      }
      console.error('Failed to fetch Reddit access token:', tokenRes.status, errorBody);
      return NextResponse.json({
        error: `Failed to get access token: ${errorBody.error || tokenRes.statusText}`, 
        description: errorBody.error_description 
      }, { status: tokenRes.status });
    }

    const tokenData = await tokenRes.json();
    // console.log('Reddit Access Token Data:', tokenData); 

    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Use access token to get user info (including ID)
    const userInfoResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'User-Agent': process.env.REDDIT_USER_AGENT || 'PawPalSD (by u/SDAutomatIon)', // Use your User-Agent
        }
    });

    if (!userInfoResponse.ok) {
        const errorData = await userInfoResponse.json();
        console.error('Error fetching Reddit user info:', errorData);
        return NextResponse.json({ error: 'Failed to get user info from Reddit' }, { status: userInfoResponse.status });
    }

    const userInfo = await userInfoResponse.json();
    const redditUserId = userInfo.id; // Get the unique Reddit user ID

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    const redditTokensCollection = db.collection('reddit_tokens'); // Use the 'reddit_tokens' collection

    // Store or update the tokens in MongoDB using the Reddit user ID
    const result = await redditTokensCollection.updateOne(
      { redditUserId: redditUserId }, // Find document by Reddit user ID
      {
        $set: {
          accessToken: access_token,
          refreshToken: refresh_token, // Store refresh token securely
          expiresAt: new Date(Date.now() + expires_in * 1000), // Calculate expiration time
          scope: scope,
          lastUpdated: new Date(),
        },
      },
      { upsert: true } // Create a new document if one doesn't exist
    );

    console.log(`Reddit tokens ${result.upsertedCount ? 'inserted' : 'updated'} for user ${redditUserId}`);

    // Redirect the user to a success page or your application's dashboard
    return NextResponse.redirect(new URL('/', req.url)); // Redirect to home page, for example

  } catch (error) {
    console.error('Error in Reddit callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
