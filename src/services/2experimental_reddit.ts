
'use server';

import axios from 'axios';
import { fetchPostComments, type RedditComment } from '@/services/reddit'; // Import fetchPostComments

interface GoogleOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  position?: number;
  rank?: number;
}

interface ScrapingdogGoogleResponse {
  search_information?: {
    total_results?: string;
    time_taken_displayed?: string;
    query_displayed?: string;
  };
  organic_results?: GoogleOrganicResult[];
  error?: string;
  message?: string;
  status?: number; 
}

interface FetchGoogleResultsReturnEnhanced {
  results: GoogleOrganicResult[];
  debugLogs: string[];
}

interface FetchTopLinksReturn {
  summary: string;
  debugLogs: string[];
}

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;
const browserUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';


function extractPostIdFromUrl(url: string): string | null {
    // Regex to capture the post ID from various Reddit URL formats
    // Handles:
    // - /r/subreddit/comments/postid/title/
    // - /r/subreddit/comments/postid/
    // - /comments/postid/
    // - /postid (less common, but good to be robust)
    // It looks for "/comments/" followed by an alphanumeric ID, or just an ID if it's at the end of a path segment.
    const match = url.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i);
    if (match && match[1]) {
      return match[1];
    }
    // Fallback for URLs that might just end in /postid or have it as a segment
    const simpleIdMatch = url.match(/\/([a-z0-9]{6,})(?:\/|\?|$)/i);
    if (simpleIdMatch && simpleIdMatch[1] && simpleIdMatch[1].length >= 6 && !simpleIdMatch[1].includes('/')) {
        // Check if it's not a common subreddit name mistaken for an ID
        if (!["r", "u", "user", "wiki", "submit", "message", "login", "search"].includes(simpleIdMatch[1].toLowerCase())) {
            return simpleIdMatch[1];
        }
    }
    return null;
  }
  

async function fetchGoogleSearchResults(
  userQuestion: string,
  localDebugLogs: string[]
): Promise<FetchGoogleResultsReturnEnhanced> {
  localDebugLogs.push(`[Experimental Reddit] fetchGoogleSearchResults received original userQuestion: "${userQuestion}"`);

  if (!SCRAPINGDOG_API_KEY) {
    const errorMsg = "[Experimental Reddit] Scrapingdog API Key not configured.";
    console.error(errorMsg);
    localDebugLogs.push(errorMsg);
    return { results: [], debugLogs: localDebugLogs };
  }

  const lowerUserQuestion = userQuestion.toLowerCase();
  localDebugLogs.push(`[Experimental Reddit] userQuestion after toLowerCase(): "${lowerUserQuestion}"`);

  const googleQueryString = `${lowerUserQuestion} site:reddit.com`;
  localDebugLogs.push(`[Experimental Reddit] Full googleQueryString for Scrapingdog (pre-encoding): "${googleQueryString}"`);

  const encodedGoogleQueryString = encodeURIComponent(googleQueryString);
  localDebugLogs.push(`[Experimental Reddit] Encoded googleQueryString for URL: "${encodedGoogleQueryString}"`);
  
  const apiUrl = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&query=${encodedGoogleQueryString}&page=0&country=us&results=10&advance_search=true&ai_overview=false`;
  localDebugLogs.push(`[Experimental Reddit] Final Constructed Scrapingdog API URL: ${apiUrl}`);
  
  const requestConfig = {
    headers: {
      'User-Agent': browserUserAgent,
      'Accept': '*/*', // Mimic cURL more closely
    },
  };
  localDebugLogs.push(`[Experimental Reddit] Axios request config being used: ${JSON.stringify(requestConfig, null, 2)}`);
  localDebugLogs.push(`[Experimental Reddit] Attempting to call Scrapingdog API with User-Agent: "${browserUserAgent}"...`);

  try {
    const { data } = await axios.get<ScrapingdogGoogleResponse>(apiUrl, requestConfig);
    localDebugLogs.push(`[Experimental Reddit] Scrapingdog API call completed successfully. Status in data: ${data.status || 'N/A (status not in data body)'}`);
    localDebugLogs.push(`[Experimental Reddit] Raw FULL JSON response from Scrapingdog: ${JSON.stringify(data, null, 2)}`);

    if (data.error || (data.message && data.status && data.status >= 400)) {
      const apiErrorMsg = `[Experimental Reddit] Scrapingdog API returned an error in response body: ${data.error || data.message}. Status: ${data.status || 'N/A'}`;
      localDebugLogs.push(apiErrorMsg);
      return { results: [], debugLogs: localDebugLogs };
    }

    if (!data.organic_results) {
      const noResultsMsg = `[Experimental Reddit] No 'organic_results' field found in Scrapingdog response.`;
      localDebugLogs.push(noResultsMsg);
      return { results: [], debugLogs: localDebugLogs };
    }

    localDebugLogs.push(`[Experimental Reddit] 'organic_results' length: ${data.organic_results.length}.`);
    return { results: data.organic_results, debugLogs: localDebugLogs };
  } catch (err: any) {
    localDebugLogs.push(`[Experimental Reddit] Axios CATCH block entered for Scrapingdog API call to ${apiUrl}.`);
    let detailedError = err.message;

    if (axios.isAxiosError(err)) {
      detailedError = `${err.message}${err.response ? ` | Status: ${err.response.status} | Response Data: ${JSON.stringify(err.response.data)}` : ''}`;
      localDebugLogs.push(`[Experimental Reddit] Error is AxiosError. Code: ${err.code || 'N/A'}`);
      if (err.response) {
        localDebugLogs.push(`[Experimental Reddit] err.response.status: ${err.response.status}`);
        localDebugLogs.push(`[Experimental Reddit] err.response.data: ${JSON.stringify(err.response.data, null, 2)}`);
        localDebugLogs.push(`[Experimental Reddit] err.response.headers: ${JSON.stringify(err.response.headers, null, 2)}`);
      } else if (err.request) {
        localDebugLogs.push(`[Experimental Reddit] No response received (err.request is present).`);
      } else {
        localDebugLogs.push(`[Experimental Reddit] AxiosError without response or request object: ${err.message}`);
      }
    } else {
       localDebugLogs.push(`[Experimental Reddit] Error is not an AxiosError. Type: ${typeof err}. Message: ${err.message}`);
    }
    
    if (err.config) {
        localDebugLogs.push(`[Experimental Reddit] Axios config for failed request: ${JSON.stringify(err.config, null, 2)}`);
    } else {
        localDebugLogs.push(`[Experimental Reddit] No err.config available for failed request.`);
    }
    localDebugLogs.push(`[Experimental Reddit] Full Axios error during Scrapingdog API call: ${detailedError}`);
    return { results: [], debugLogs: localDebugLogs };
  }
}

export async function fetchTopGoogleRedditLinksAndDebug(
  userQuery: string,
  resultLimit = 3
): Promise<FetchTopLinksReturn> {
  const cumulativeDebugLogs: string[] = [];
  cumulativeDebugLogs.push(`[Experimental Reddit] Starting fetchTopGoogleRedditLinksAndDebug for userQuery: "${userQuery}", resultLimit: ${resultLimit}`);

  try {
    const { results: googleResults, debugLogs: searchDebugLogs } = await fetchGoogleSearchResults(userQuery, cumulativeDebugLogs);

    if (!googleResults || googleResults.length === 0) {
      cumulativeDebugLogs.push("[Experimental Reddit] No Google results returned from fetchGoogleSearchResults to process further.");
      return {
        summary: "Scrapingdog/Google search returned no organic results for your query.",
        debugLogs: cumulativeDebugLogs,
      };
    }
    
    const redditSiteLinksWithTitles = googleResults
      .filter(r => r.link && r.link.toLowerCase().includes("reddit.com"))
      .map(r => ({ link: r.link, title: r.title || "Untitled Reddit Post" })); // Keep title for context

    cumulativeDebugLogs.push(`[Experimental Reddit] Filtered Reddit-specific results (count: ${redditSiteLinksWithTitles.length}): ${JSON.stringify(redditSiteLinksWithTitles)}`);

    if (!redditSiteLinksWithTitles.length) {
      cumulativeDebugLogs.push("[Experimental Reddit] No reddit.com links found after filtering Google results.");
      return {
        summary: "No Reddit.com links found in the Google search results for your query.",
        debugLogs: cumulativeDebugLogs,
      };
    }

    const topResultsToProcess = redditSiteLinksWithTitles.slice(0, resultLimit);
    cumulativeDebugLogs.push(`[Experimental Reddit] Processing top ${topResultsToProcess.length} Google results for Reddit links.`);

    let combinedSummary = `Based on Reddit discussions (found via Google) related to your query "${userQuery}":\n\n`;
    let postsProcessedCount = 0;

    for (const result of topResultsToProcess) {
      cumulativeDebugLogs.push(`[Experimental Reddit] Processing Google result: Title: "${result.title}", Link: "${result.link}"`);
      const postId = extractPostIdFromUrl(result.link);

      if (postId) {
        cumulativeDebugLogs.push(`[Experimental Reddit] Extracted Post ID: ${postId} from URL: ${result.link}`);
        cumulativeDebugLogs.push(`[Experimental Reddit] Attempting to fetch comments for post: t3_${postId} (Title: ${result.title})`);
        
        const { comments, debugLogs: commentFetchLogs } = await fetchPostComments(`t3_${postId}`, 2); // Fetch 2 comments per post
        cumulativeDebugLogs.push(...commentFetchLogs.map(log => `[Experimental Reddit - Comments for t3_${postId}] ${log}`));

        if (comments.length > 0) {
          postsProcessedCount++;
          combinedSummary += `Post: "${result.title}" (Source: ${result.link})\n`;
          comments.forEach(comment => {
            combinedSummary += `- Comment by u/${comment.author}: ${comment.body.substring(0, 150)}${comment.body.length > 150 ? '...' : ''}\n`;
          });
          combinedSummary += "\n";
          cumulativeDebugLogs.push(`[Experimental Reddit] Successfully fetched ${comments.length} comments for post t3_${postId}.`);
        } else {
          cumulativeDebugLogs.push(`[Experimental Reddit] No relevant comments found or fetched for post t3_${postId}.`);
           combinedSummary += `Post: "${result.title}" (Source: ${result.link})\n- No relevant comments found for this post.\n\n`;
        }
      } else {
        cumulativeDebugLogs.push(`[Experimental Reddit] Could not extract post ID from URL: ${result.link}. Skipping comment fetch for this link.`);
         combinedSummary += `Found link: ${result.link} (Could not extract Reddit post ID to fetch comments).\n\n`;
      }
    }
    
    if (postsProcessedCount === 0 && topResultsToProcess.length > 0) {
        combinedSummary = `Found ${topResultsToProcess.length} Reddit link(s) via Google, but could not fetch relevant comments or extract post IDs from them. Links found:\n` + topResultsToProcess.map((r,i) => `${i+1}. ${r.link}`).join('\n');
    } else if (postsProcessedCount === 0 && topResultsToProcess.length === 0){
        combinedSummary = "No relevant Reddit posts with comments found via Google for your query.";
    }


    cumulativeDebugLogs.push(`[Experimental Reddit] Final summary constructed. Length: ${combinedSummary.trim().length}`);
    return { summary: combinedSummary.trim(), debugLogs: cumulativeDebugLogs };

  } catch (error: any) {
    cumulativeDebugLogs.push(`[Experimental Reddit] CRITICAL Error in fetchTopGoogleRedditLinksAndDebug: ${error.message}`);
    if (error.stack) {
      cumulativeDebugLogs.push(`[Experimental Reddit] Stack trace: ${error.stack.substring(0, 300)}...`);
    }
    return {
      summary: `Error fetching and processing Reddit links via Google: ${error.message}`,
      debugLogs: cumulativeDebugLogs,
    };
  }
}

    