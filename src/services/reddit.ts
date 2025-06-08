
import { Buffer } from 'buffer';
import axios from 'axios';

let redditAccessToken: string | null = null;
let tokenExpirationTime: number | null = null;

const getNewAccessToken = async (): Promise<string> => {
  const client_id = process.env.REDDIT_CLIENT_ID;
  const client_secret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT || 'PawPalSD/1.0 (by u/SDAutomatIon)';

  console.log('[RedditService] Attempting to get new access token.');
  if (!client_id || !client_secret) {
    console.error('[RedditService] Reddit Client ID or Client Secret not configured.');
    throw new Error('Reddit Client ID and Client Secret not configured.');
  }

  const auth = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

  try {
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
      }
    );

    const { access_token, expires_in } = response.data;
    redditAccessToken = access_token;
    tokenExpirationTime = Math.floor(Date.now() / 1000) + expires_in - 60; // Refresh 60 seconds before expiry
    console.log('[RedditService] Successfully acquired new Reddit access token.');
    return access_token;
  } catch (error: any) {
    console.error('[RedditService] Error getting new Reddit access token:', error.response?.data || error.message);
    throw new Error('Failed to get new Reddit access token.');
  }
};

export async function makeAuthenticatedRedditRequest(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any
): Promise<any> {
  const userAgent = process.env.REDDIT_USER_AGENT || 'PawPalSD/1.0 (by u/SDAutomatIon)';
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    if (!redditAccessToken || !tokenExpirationTime || currentTime >= tokenExpirationTime) {
      console.log('[RedditService] Reddit access token expired or not available. Getting a new one...');
      await getNewAccessToken();
    }

    const response = await axios({
      method,
      url,
      data,
      headers: {
        Authorization: `Bearer ${redditAccessToken}`,
        'User-Agent': userAgent,
      },
    });
    return response.data;
  } catch (error) {
    console.error('[RedditService] Error making authenticated Reddit request:', error);
    throw error;
  }
}

export interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  url: string;
  score: number;
  num_comments: number;
  subreddit: string;
  author: string;
  created_utc: number;
  permalink: string;
}

interface RedditListingChild {
  kind: string;
  data: RedditPost;
}

interface RedditSearchResponse {
  kind: string;
  data: {
    after: string | null;
    dist: number;
    modhash: string;
    geo_filter: string | null;
    children: RedditListingChild[];
    before: string | null;
  };
}

export async function searchReddit(
  query: string,
  subreddits?: string[], 
  limit: number = 5, // Default limit increased slightly for initial fetch
  sort: 'relevance' | 'hot' | 'top' | 'new' | 'comments' = 'relevance',
  timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'year',
  primarySubreddit?: string 
): Promise<RedditPost[]> {
  let url: string;
  let searchParams: URLSearchParams;

  console.log(`[RedditService] Searching Reddit. Query: "${query}", Primary Subreddit: ${primarySubreddit}, Limit: ${limit}`);

  if (primarySubreddit) {
    url = `https://oauth.reddit.com/r/${primarySubreddit}/search.json`;
    searchParams = new URLSearchParams({
      q: query,
      restrict_sr: '1', 
      limit: limit.toString(),
      sort,
      t: timeframe,
    });
  } else if (subreddits && subreddits.length > 0) {
    const subredditQueryPart = subreddits.map(sr => `subreddit:${sr}`).join(' OR ');
    const fullQuery = `${query} (${subredditQueryPart})`;
    url = `https://oauth.reddit.com/search.json`;
    searchParams = new URLSearchParams({
      q: fullQuery,
      limit: limit.toString(),
      sort,
      t: timeframe,
      restrict_sr: '0', 
    });
  } else {
    url = `https://oauth.reddit.com/search.json`;
    searchParams = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      sort,
      t: timeframe,
    });
  }
  
  const fullUrl = `${url}?${searchParams.toString()}`;
  console.log(`[RedditService] Fetching URL: ${fullUrl}`);

  try {
    const responseData: RedditSearchResponse = await makeAuthenticatedRedditRequest(fullUrl, 'GET');
    if (responseData && responseData.data && responseData.data.children) {
      if (responseData.data.children.length === 0) {
        console.log(`[RedditService] Reddit search for "${query}" on "${primarySubreddit || 'all'}" returned 0 results.`);
      } else {
        console.log(`[RedditService] Reddit search for "${query}" on "${primarySubreddit || 'all'}" returned ${responseData.data.children.length} results.`);
      }
      return responseData.data.children.map(child => child.data);
    }
    console.log(`[RedditService] Reddit search for "${query}" on "${primarySubreddit || 'all'}" returned no data.children.`);
    return [];
  } catch (error: any) {
    console.error(`[RedditService] Error searching Reddit for "${query}":`, error.response?.data || error.message);
    return []; 
  }
}
