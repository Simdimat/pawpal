import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Buffer } from 'buffer';

// Placeholder for how you might get the user's tokens and expiration.
// In a real application, this would involve fetching from your database
// based on the currently authenticated user.
async function getUserRedditTokens(userId: string): Promise<{ accessToken: string; expiresAt: Date; refreshToken: string } | null> {
  // Connect to MongoDB
  const { db } = await connectToDatabase();
  const redditTokensCollection = db.collection('reddit_tokens');

  // Find the user's document
  const userDocument = await redditTokensCollection.findOne({ redditUserId: userId });

  if (userDocument && userDocument.accessToken && userDocument.expiresAt && userDocument.refreshToken) {
    return {
      accessToken: userDocument.accessToken,
      expiresAt: userDocument.expiresAt,
      refreshToken: userDocument.refreshToken,
    };
  }

  return null; // Tokens not found for this user
}

// Placeholder for updating user tokens after a refresh
async function updateUserRedditTokens(userId: string, accessToken: string, expiresAt: Date, refreshToken: string): Promise<void> {
  // Connect to MongoDB
  const { db } = await connectToDatabase();
  const redditTokensCollection = db.collection('reddit_tokens');

  await redditTokensCollection.updateOne(
    { redditUserId: userId },
    {
      $set: {
        accessToken: accessToken,
        expiresAt: expiresAt,
        refreshToken: refreshToken,
        lastUpdated: new Date(),
      },
    }
  );
}


async function refreshRedditToken(userId: string): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string } | null> {
    try {
      const response = await fetch('/api/reddit/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        console.error('Failed to call refresh token API:', response.statusText);
        // You might want to throw an error here or return a specific error object
        return null;
      }

      const data = await response.json();
      if (data.accessToken && data.expiresIn) {
          return data; // Returns the new access token and its expiration
      }

      return null; // Refresh failed or response was unexpected

    } catch (error) {
      console.error('Error refreshing Reddit token:', error);
      throw new Error('Error during token refresh process.'); // Re-throw for the calling function to handle
    }
  }


/**
 * Makes an authenticated request to the Reddit API, handling token refresh.
 * @param userId The unique identifier for the user.
 * @param url The Reddit API endpoint URL.
 * @param options Fetch options for the request.
 * @returns The response from the Reddit API.
 */
export async function makeAuthenticatedRedditRequest(userId: string, url: string, options: RequestInit = {}): Promise<Response> {
  let userTokens = await getUserRedditTokens(userId);

  if (!userTokens) {
    throw new Error('Reddit tokens not found for user. Please log in.');
  }

  const now = new Date();
  const expirationThreshold = 60 * 1000; // Refresh if token expires in the next 60 seconds

  if (userTokens.expiresAt.getTime() < now.getTime() + expirationThreshold) {
    console.log('Reddit access token expired or near expiration for user:', userId, 'Refreshing...');
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }), // Send the user identifier to the refresh route
    });

    if (!refreshResponse.ok) {

    const refreshedTokens = await refreshRedditToken(userId);

    if (!refreshedTokens) {
      console.error('Failed to refresh Reddit token for user:', userId);
      throw new Error('Failed to refresh Reddit token. Please re-authorize.'); // Indicate that user needs to re-authorize
    }

    // Update the userTokens object with the new data
    userTokens = {
      accessToken: refreshedTokens.accessToken,
     // If refreshData.refreshToken is present, update the userTokens object with it before updating the DB
     if (refreshData.refreshToken) {
        userTokens.refreshToken = refreshData.refreshToken;
     }
     await updateUserRedditTokens(userId, userTokens.accessToken, userTokens.expiresAt, userTokens.refreshToken);


    console.log(`Token refreshed successfully for user ${userId}.`);
  }

  // Use the valid (either original or refreshed) access token for the API request
  const headers: HeadersInit = {
    ...options.headers,
    'Authorization': `Bearer ${userTokens.accessToken}`,
    'User-Agent': process.env.REDDIT_USER_AGENT || 'PawPalSD (by u/SDAutomatIon)', // Use your User-Agent
  };

  const authenticatedOptions: RequestInit = {
    ...options,
    headers,
  };

  // Make the actual request to the Reddit API
  const apiResponse = await fetch(url, authenticatedOptions);

  // You might want to add error handling here for the API response (e.g., 401 Unauthorized if the new token is also invalid)
  if (!apiResponse.ok) {
      // Depending on the status code, you might need specific error handling
      console.error(`Reddit API request failed with status ${apiResponse.status} for URL: ${url}`);
      throw new Error(`Reddit API request failed: ${apiResponse.statusText}`);
  }


  return apiResponse;
}

// Example function using the helper (you'll add more specific Reddit API call functions)
export async function getMe(userId: string) {
    const url = 'https://oauth.reddit.com/api/v1/me';
    try {
        const response = await makeAuthenticatedRedditRequest(userId, url);
        const userData = await response.json();
        console.log('Fetched Reddit user data:', userData);
        return userData;
    } catch (error) {
        console.error('Error fetching Reddit user data:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}