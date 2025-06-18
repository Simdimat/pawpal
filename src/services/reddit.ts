
import { Buffer } from 'buffer';
import axios from 'axios';

let redditAccessToken: string | null = null;
let tokenExpirationTime: number | null = null;

function getUserAgent(): string {
  const appOwnerUsername = process.env.REDDIT_APP_OWNER_USERNAME;
  // Ensure there's a fallback if REDDIT_APP_OWNER_USERNAME is somehow undefined or empty after .env processing
  const effectiveUsername = appOwnerUsername || 'PawPalSDAppUser'; 
  
  if (!appOwnerUsername) {
    console.warn(`[RedditService] REDDIT_APP_OWNER_USERNAME environment variable is not set. Using fallback "${effectiveUsername}". Please set it for optimal Reddit API compliance.`);
  } else if (appOwnerUsername === 'YOUR_REDDIT_USERNAME_HERE') {
    console.warn(`[RedditService] REDDIT_APP_OWNER_USERNAME is set to placeholder "YOUR_REDDIT_USERNAME_HERE". Using fallback "${effectiveUsername}". Please update it with your actual Reddit username.`);
  }
  return `web:com.pawpalsd.app:v1.0.2 (by /u/${effectiveUsername})`;
}

const getNewAccessToken = async (): Promise<{ token: string, debugLogs: string[] }> => {
  const debugLogs: string[] = [];
  const client_id = process.env.REDDIT_CLIENT_ID;
  const client_secret = process.env.REDDIT_CLIENT_SECRET;
  const effectiveUserAgent = getUserAgent();

  debugLogs.push(`[RedditService] Attempting to get new access token. User-Agent: ${effectiveUserAgent}. Client ID set: ${!!client_id}`);
  if (!client_id || !client_secret) {
    const errMsg = '[RedditService] Reddit Client ID or Client Secret not configured.';
    console.error(errMsg);
    debugLogs.push(errMsg);
    throw new Error('Reddit Client ID and Client Secret not configured.');
  }

  const auth = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

  try {
    debugLogs.push(`[RedditService] Posting to Reddit token endpoint. Auth: Basic ${auth.substring(0,10)}...`);
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': effectiveUserAgent,
        },
      }
    );

    const { access_token, expires_in } = response.data;
    redditAccessToken = access_token;
    tokenExpirationTime = Math.floor(Date.now() / 1000) + expires_in - 60; // Refresh 60 seconds before expiry
    const successMsg = `[RedditService] Successfully acquired new Reddit access token. Expires in: ${expires_in}s.`;
    console.log(successMsg);
    debugLogs.push(successMsg);
    return { token: access_token, debugLogs };
  } catch (error: any) {
    const errMsgPrefix = '[RedditService] Error getting new Reddit access token.';
    console.error(errMsgPrefix);
    debugLogs.push(errMsgPrefix);
    if (axios.isAxiosError(error) && error.response) {
      const errDetail = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
      console.error(`[RedditService] New Token Error Response Details: ${errDetail}`);
      debugLogs.push(`New Token Error Response Details: ${errDetail}`);
      const apiErrorMsg = error.response.data?.message || error.response.data?.error_description || error.response.data?.error || error.message;
      throw new Error(`Reddit Token API Error (${error.response.status}): ${apiErrorMsg}. Full details: ${JSON.stringify(error.response.data)}`);
    } else {
      const nonAxiosMsg = `Non-Axios error during token fetch: ${error.message}`;
      console.error(`[RedditService] ${nonAxiosMsg}`);
      debugLogs.push(nonAxiosMsg);
    }
    throw new Error('Failed to get new Reddit access token.');
  }
};

export async function makeAuthenticatedRedditRequest(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any
): Promise<{ responseData: any, debugLogs: string[] }> {
  const debugLogs: string[] = [];
  const effectiveUserAgent = getUserAgent();
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    if (!redditAccessToken || !tokenExpirationTime || currentTime >= tokenExpirationTime) {
      debugLogs.push(`[RedditService] Reddit access token expired (exp: ${tokenExpirationTime}, current: ${currentTime}) or not available. Getting a new one...`);
      const { token, debugLogs: tokenDebugLogs } = await getNewAccessToken();
      debugLogs.push(...tokenDebugLogs);
      redditAccessToken = token;
    }

    debugLogs.push(`[RedditService] Making authenticated request. URL: ${url}, Method: ${method}`);
    const response = await axios({
      method,
      url,
      data,
      headers: {
        Authorization: `Bearer ${redditAccessToken}`,
        'User-Agent': effectiveUserAgent,
      },
    });
    debugLogs.push(`[RedditService] Authenticated request to ${url} successful. Status: ${response.status}`);
    return { responseData: response.data, debugLogs };
  } catch (error: any) {
    const errorPrefix = `[RedditService] Error during authenticated request to ${url}.`;
    debugLogs.push(errorPrefix);
    if (axios.isAxiosError(error)) {
      const axiosErrorMsg = `Axios error: ${error.message}`;
      console.error(`${errorPrefix} ${axiosErrorMsg}`);
      debugLogs.push(axiosErrorMsg);
      if (error.response) {
        const errDetail = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
        console.error(`[RedditService] Error Response Details: ${errDetail}`);
        debugLogs.push(`Error Response Details: ${errDetail}`);
        const apiErrorMsg = error.response.data?.message || error.response.data?.error_description || error.response.data?.error || 'Unknown API error from response data.';
        throw new Error(`Reddit API Error (${error.response.status}): ${apiErrorMsg}. Full details: ${JSON.stringify(error.response.data)}`);
      } else {
        debugLogs.push(`Axios error without response object.`);
      }
    } else {
      const nonAxiosMsg = `Non-Axios error: ${error.message || String(error)}`;
      console.error(`${errorPrefix} ${nonAxiosMsg}`);
      debugLogs.push(nonAxiosMsg);
    }
    throw error.message ? error : new Error('Failed authenticated Reddit request');
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
  name: string; // Fullname, e.g., t3_xxxxxx
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
  subreddits?: string[], // e.g., ['sandiego', 'dogs']
  limit: number = 5,
  sort: 'relevance' | 'hot' | 'top' | 'new' | 'comments' = 'relevance',
  timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'year',
  targetSubredditForUrl?: string, // If provided, constructs URL like /r/targetSubreddit/search
  restrictToSubredditInQuery: boolean = true // if targetSubredditForUrl, use restrict_sr=1
): Promise<{posts: RedditPost[], debugLogs: string[]}> {
  const debugLogs: string[] = [];
  let url: string;
  let searchParams: URLSearchParams;

  debugLogs.push(`[RedditService] searchReddit initiated. Query: "${query}", Target Subreddit: ${targetSubredditForUrl}, Subreddits in query: ${subreddits ? subreddits.join(', ') : 'N/A'}, Limit: ${limit}, RestrictToSubreddit: ${restrictToSubredditInQuery}`);

  if (targetSubredditForUrl) {
    url = `https://oauth.reddit.com/r/${targetSubredditForUrl}/search.json`;
    searchParams = new URLSearchParams({
      q: query, // Query itself might contain subreddit filters if subreddits array is also used
      limit: limit.toString(),
      sort,
      t: timeframe,
    });
    if (restrictToSubredditInQuery) {
      searchParams.append('restrict_sr', '1');
      debugLogs.push(`[RedditService] Searching in r/${targetSubredditForUrl} with restrict_sr=1.`);
    } else {
      debugLogs.push(`[RedditService] Searching in r/${targetSubredditForUrl} (restrict_sr=0 or not set). Query should handle subreddit scoping.`);
    }
  } else if (subreddits && subreddits.length > 0) {
    // If specific subreddits are given (but not a single target for URL construction),
    // include them in the general search query.
    const subredditQueryPart = subreddits.map(sr => `subreddit:${sr}`).join(' OR ');
    const fullQuery = `${query} (${subredditQueryPart})`;
    url = `https://oauth.reddit.com/search.json`;
    searchParams = new URLSearchParams({
      q: fullQuery,
      limit: limit.toString(),
      sort,
      t: timeframe,
    });
     debugLogs.push(`[RedditService] General search with subreddit filters in query: "${fullQuery}"`);
  } else {
    // General search across all Reddit if no subreddits specified
    url = `https://oauth.reddit.com/search.json`;
    searchParams = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      sort,
      t: timeframe,
    });
    debugLogs.push(`[RedditService] Performing general Reddit search for query: "${query}"`);
  }

  const fullUrl = `${url}?${searchParams.toString()}`;
  debugLogs.push(`[RedditService] Fetching search results from URL: ${fullUrl}`);

  try {
    const { responseData, debugLogs: requestDebugLogs } = await makeAuthenticatedRedditRequest(fullUrl, 'GET');
    debugLogs.push(...requestDebugLogs);
    const searchData = responseData as RedditSearchResponse;

    if (searchData && searchData.data && searchData.data.children) {
      if (searchData.data.children.length === 0) {
        debugLogs.push(`[RedditService] Reddit search returned 0 results.`);
      } else {
        debugLogs.push(`[RedditService] Reddit search returned ${searchData.data.children.length} results.`);
        // debugLogs.push(`[RedditService] Sample posts (first 2 titles if available): ${searchData.data.children.slice(0,2).map(p => p.data.title).join('; ')}`);
      }
      return { posts: searchData.data.children.map(child => child.data), debugLogs };
    }
    debugLogs.push(`[RedditService] Reddit search returned no data.children or unexpected structure. Response sample: ${JSON.stringify(searchData).substring(0,200)}`);
    return { posts: [], debugLogs };
  } catch (error: any) {
    const errorMsg = `[RedditService] searchReddit failed. Query: "${query}", URL: ${fullUrl}, Error: ${error.message}`;
    console.error(errorMsg, error);
    debugLogs.push(errorMsg);
    if (error.response && error.response.data) {
      debugLogs.push(`[RedditService] Reddit API Error Data (search): ${JSON.stringify(error.response.data)}`);
    }
    return { posts: [], debugLogs };
  }
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  name: string; // Fullname, e.g., t1_xxxxxx
  permalink: string; // e.g., /r/subreddit/comments/postid/comment_title/commentid/
}

interface RedditCommentListingChild {
  kind: string; // Should be 't1' for comments
  data: RedditComment;
}

interface RedditCommentsResponseElement { 
  kind: string; // 'Listing'
  data: {
    after: string | null;
    dist: number | null;
    modhash: string | null;
    geo_filter: string | null;
    children: RedditCommentListingChild[] | { kind: string; data: RedditPost }[]; // Can be post data for index 0
    before: string | null;
  };
}
type RedditCommentsResponse = RedditCommentsResponseElement[];


export async function fetchPostComments(
  postIdOrFullName: string, 
  limit: number = 3, 
  sort: 'confidence' | 'top' | 'new' | 'controversial' | 'old' | 'random' | 'qa' | 'live' = 'top'
): Promise<{comments: RedditComment[], debugLogs: string[]}> {
  const debugLogs: string[] = [];
  const postBaseId = postIdOrFullName.startsWith('t3_') ? postIdOrFullName.substring(3) : postIdOrFullName;
  const postFullName = `t3_${postBaseId}`;
  
  const url = `https://oauth.reddit.com/comments/${postBaseId}.json`; 
  const params = new URLSearchParams({
    sort: sort,
    limit: (limit + 5).toString(), // Fetch more to filter effectively
    depth: '1', 
  });
  const fullUrl = `${url}?${params.toString()}`;
  debugLogs.push(`[RedditService] Fetching comments for post ${postFullName} from URL: ${fullUrl}`);

  try {
    const { responseData, debugLogs: requestDebugLogs } = await makeAuthenticatedRedditRequest(fullUrl, 'GET');
    debugLogs.push(...requestDebugLogs);
    const commentsResponse = responseData as RedditCommentsResponse;

    // Comments are typically in the second element of the response array
    if (commentsResponse && commentsResponse.length > 1 && commentsResponse[1] && commentsResponse[1].kind === 'Listing' && commentsResponse[1].data && commentsResponse[1].data.children) {
      const commentsData = commentsResponse[1].data.children as RedditCommentListingChild[]; // Cast here
      debugLogs.push(`[RedditService] Received ${commentsData.length} raw comment items for post ${postFullName}.`);

      const comments: RedditComment[] = commentsData
        .filter(child => child.kind === 't1' && child.data && child.data.body && child.data.body !== '[deleted]' && child.data.body !== '[removed]' && child.data.author !== 'AutoModerator')
        .map(child => child.data)
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .slice(0, limit); 

      debugLogs.push(`[RedditService] Processed ${comments.length} valid, sorted comments for post ${postFullName}.`);
      return { comments, debugLogs };
    }
    debugLogs.push(`[RedditService] No comments found or unexpected response structure for post ${postFullName}. Response[1].kind: ${commentsResponse?.[1]?.kind}. Response sample: ${JSON.stringify(commentsResponse).substring(0,300)}`);
    return { comments: [], debugLogs };
  } catch (error: any) {
    const errorMsg = `[RedditService] Fetch comments failed for post ${postFullName}. Error: ${error.message}`;
    console.error(errorMsg, error);
    debugLogs.push(errorMsg);
    if (error.response && error.response.data) { 
      debugLogs.push(`[RedditService] Reddit API Error Data (comments): ${JSON.stringify(error.response.data)}`);
    }
    return { comments: [], debugLogs };
  }
}
