
'use server';

import axios from 'axios';
import { fetchPostComments, type RedditComment } from '@/services/reddit'; 

interface GoogleOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface ScrapingdogGoogleResponse {
  search_information?: {
    total_results?: string;
    time_taken_displayed?: string;
    query_displayed?: string;
  };
  organic_results?: GoogleOrganicResult[];
}

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

async function fetchGoogleSearchResults(userQuestion: string): Promise<GoogleOrganicResult[]> {
  if (!SCRAPINGDOG_API_KEY) {
    console.error("[Experimental Reddit] Scrapingdog API Key not configured.");
    throw new Error("Scrapingdog API Key not configured. Please set SCRAPINGDOG_API_KEY in your environment variables.");
  }
  const query = `${userQuestion} site:reddit.com`;
  const url = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&q=${encodeURIComponent(query)}&page=0&location=United+States`;

  console.log(`[Experimental Reddit] Fetching Google search results from Scrapingdog for query: "${query}"`);

  try {
    const { data } = await axios.get<ScrapingdogGoogleResponse>(url);
    if (!data.organic_results || data.organic_results.length === 0) {
      console.warn("[Experimental Reddit] No organic results found by Scrapingdog for:", query);
      return [];
    }
    return data.organic_results;
  } catch (err: any) {
    console.error("[Experimental Reddit] Scrapingdog API error during Google search:", err.response?.data || err.message);
    if (err.response?.data) {
        console.error("Scrapingdog error details:", JSON.stringify(err.response.data, null, 2));
    }
    const detail = err.response?.data?.message || err.message;
    throw new Error(`Scrapingdog API error: ${detail}`);
  }
}

function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/comments\/([a-zA-Z0-9]+)(?:\/|$)/);
  if (match && match[1]) {
    return match[1];
  }
  console.warn(`[Experimental Reddit] Could not extract post ID from URL: ${url}`);
  return null;
}

export async function searchAndFetchFullRedditPosts(userQuestion: string, resultLimit: number = 2): Promise<string> {
  try {
    const googleResults = await fetchGoogleSearchResults(userQuestion);

    if (googleResults.length === 0) {
      return "No relevant Reddit discussions found via Google search for your query.";
    }

    const topResults = googleResults.slice(0, resultLimit);
    let summary = `Found these Reddit discussions based on your query "${userQuestion}":\n\n`;
    let postsProcessed = 0;
    let firstCommentErrorDetail: string | null = null;

    for (const result of topResults) {
      const postIdBase = extractPostIdFromUrl(result.link);
      if (!postIdBase) {
        summary += `Could not process link: ${result.link}\n`;
        continue;
      }

      const postFullName = `t3_${postIdBase}`; // Reddit API expects fullname with t3_ prefix for posts
      console.log(`[Experimental Reddit] Fetching comments for post: ${postFullName} (Title: ${result.title})`);

      try {
        const comments: RedditComment[] = await fetchPostComments(postFullName, 2); // Fetch top 2 comments

        summary += `Post: "${result.title}"\n`;
        if (result.snippet) {
             summary += `  Snippet: ${result.snippet.substring(0,150)}...\n`;
        }

        if (comments.length > 0) {
          summary += `  Top Comments:\n`;
          comments.forEach(comment => {
            summary += `    - "${comment.body.substring(0, 100).trim()}${comment.body.length > 100 ? '...' : ''}" (Score: ${comment.score})\n`;
          });
        } else {
          summary += `  No comments found or comments could not be retrieved for this post.\n`;
        }
        summary += "\n";
        postsProcessed++;
      } catch (commentError: any) {
        let errorDetail = commentError.message || "Unknown error fetching comments";
        
        // Attempt to get more detailed error from Axios response if available
        if (axios.isAxiosError(commentError) && commentError.response && commentError.response.data) {
            console.error(`[Experimental Reddit] Full comment error data for ${postFullName}:`, JSON.stringify(commentError.response.data, null, 2));
            const redditErrorMsg = commentError.response.data?.message || commentError.response.data?.error_description || commentError.response.data?.error;
            if (redditErrorMsg) {
                errorDetail = `Reddit API Error (${commentError.response.status}): ${redditErrorMsg}. Full Response: ${JSON.stringify(commentError.response.data)}`;
            } else {
                errorDetail = `Reddit API Error (${commentError.response.status}). Full Response: ${JSON.stringify(commentError.response.data)}`;
            }
        } else {
            console.error(`[Experimental Reddit] Non-Axios error or no response data for ${postFullName}:`, commentError);
        }
        
        console.error(`[Experimental Reddit] Error fetching comments for post ${postFullName} (Title: ${result.title}):`, errorDetail);

        if (!firstCommentErrorDetail) {
          firstCommentErrorDetail = `Failed on post "${result.title}": ${errorDetail}`;
        }
        summary += `Post: "${result.title}"\n  Could not fetch comments for this post (Error: ${errorDetail.substring(0, 350)}${errorDetail.length > 350 ? '...' : ''}).\n\n`;
      }
    }

    if (postsProcessed === 0 && topResults.length > 0) {
        const baseMessage = "Found Reddit posts via Google, but encountered issues fetching their content.";
        return firstCommentErrorDetail ? `${baseMessage} First error detail: ${firstCommentErrorDetail}` : baseMessage;
    }
    if (postsProcessed === 0 && topResults.length === 0) { 
        return "No relevant Reddit discussions found via Google search for your query.";
    }

    return summary.trim();

  } catch (error: any) {
    console.error("[Experimental Reddit] Error in searchAndFetchFullRedditPosts:", error.message);
    return `Sorry, I encountered an error trying to fetch Reddit content: ${error.message.substring(0,250)}`;
  }
}
