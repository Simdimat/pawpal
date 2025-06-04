import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb'; // Adjust the path if necessary
import { ObjectId } from 'mongodb'; // Import ObjectId if you use it for user IDs

export async function POST(req: NextRequest) {
  const client_id = process.env.REDDIT_CLIENT_ID;
  const client_secret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT || 'PawPalSD (by u/SDAutomatIon)'; // Use your User-Agent

  try {
    // Assuming you send the user's identifier in the request body
    const { userId } = await req.json(); // Get the user identifier from the request body

    if (!userId) {
      return NextResponse.json({ error: 'Missing user identifier' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    const redditTokensCollection = db.collection('reddit_tokens'); // Use the 'reddit_tokens' collection

    // Find the user's document to get the refresh token
    const userDocument = await redditTokensCollection.findOne({ redditUserId: userId }); // Find by Reddit user ID

    if (!userDocument || !userDocument.refreshToken) {
      return NextResponse.json({ error: 'Refresh token not found for user' }, { status: 404 });
    }

    const refreshToken = userDocument.refreshToken;

    // Prepare the request to refresh the token
    const refreshParams = new URLSearchParams();
    refreshParams.append('grant_type', 'refresh_token');
    refreshParams.append('refresh_token', refreshToken);

    // Make the request to Reddit's token endpoint
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`,
        'User-Agent': userAgent,
      },
      body: refreshParams,
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error refreshing Reddit token:', errorData);
      // Depending on the error (e.g., invalid_grant), you might need to
      // prompt the user to re-authorize.
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: tokenResponse.status });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in, refresh_token: new_refresh_token } = tokenData;

    // Update the user's document with the new tokens and expiration time
    await redditTokensCollection.updateOne(
      { redditUserId: userId }, // Find document by Reddit user ID
      {
        $set: {
          accessToken: access_token,
          // Use the new refresh token if provided, otherwise keep the old one
          refreshToken: new_refresh_token || refreshToken, // Use the new refresh token if provided, otherwise keep the old one
          expiresAt: new Date(Date.now() + expires_in * 1000), // Calculate new expiration time
          lastUpdated: new Date(),
        },
      }
    );

    console.log(`Reddit token refreshed for user ${userId}`);

    // Return the new access token to the client
    return NextResponse.json({ accessToken: access_token, expiresIn: expires_in });

  } catch (error) {
    console.error('Error in Reddit refresh token API route:', error);
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 });
  }
}