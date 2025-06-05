
import { Buffer } from 'buffer';
import axios from 'axios';

let redditAccessToken: string | null = null;
let tokenExpirationTime: number | null = null;

const getNewAccessToken = async (): Promise<string> => {
  const client_id = process.env.REDDIT_CLIENT_ID;
  const client_secret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT || 'PawPalSD/1.0 (by u/SDAutomatIon)';

  if (!client_id || !client_secret) {
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
    tokenExpirationTime = Math.floor(Date.now() / 1000) + expires_in - 60;
    console.log('Successfully acquired new Reddit access token.');
    return access_token;
  } catch (error) {
    console.error('Error getting new Reddit access token:', error);
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
      console.log('Reddit access token expired or not available. Getting a new one...');
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
    console.error('Error making authenticated Reddit request:', error);
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
  subreddits: string[] = ['sandiego', 'dogs', 'vet', 'AskVet', 'Tijuana'],
  limit: number = 5,
  sort: 'relevance' | 'hot' | 'top' | 'new' | 'comments' = 'relevance',
  timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'year'
): Promise<RedditPost[]> {
  // Construct subreddit part of the query: (subreddit:foo OR subreddit:bar)
  const subredditQueryPart = subreddits.map(sr => `subreddit:${sr}`).join(' OR ');
  const fullQuery = `${query} (${subredditQueryPart})`;
  
  // Use a general search endpoint, not restricted to one subreddit in the path if multiple are specified in query
  // Or, search across a comma-separated list of subreddits if API supports: /r/sub1+sub2/search
  // For broader search using query syntax, stick to /search
  const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(fullQuery)}&limit=${limit}&sort=${sort}&t=${timeframe}&restrict_sr=0`; // restrict_sr=0 to search all specified subreddits

  try {
    const responseData: RedditSearchResponse = await makeAuthenticatedRedditRequest(url, 'GET');
    if (responseData && responseData.data && responseData.data.children) {
      return responseData.data.children.map(child => child.data);
    }
    return [];
  } catch (error) {
    console.error(`Error searching Reddit for "${query}":`, error);
    // Return empty array or throw a more specific error for the caller to handle
    return []; 
  }
}
