
'use server';

import axios from 'axios';
import { fetchPostComments, type RedditComment } from '@/services/reddit';

interface GoogleOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
  rank?: number; // Scrapingdog uses 'rank'
}

interface ScrapingdogGoogleResponse {
  search_information?: {
    total_results?: string;
    time_taken_displayed?: string;
    query_displayed?: string;
  };
  organic_results?: GoogleOrganicResult[];
  error?: string; // For capturing API-level errors from Scrapingdog
}

interface FetchGoogleResultsReturn {
  results: GoogleOrganicResult[];
  debugLogs: string[];
}

interface SearchAndFetchReturn {
  summary: string;
  debugLogs: string[];
}

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

async function fetchGoogleSearchResults(userQuestion: string): Promise<FetchGoogleResultsReturn> {
  const localDebugLogs: string[] = [];
  if (!SCRAPINGDOG_API_KEY) {
    const errorMsg = "[Experimental Reddit] Scrapingdog API Key not configured.";
    console.error(errorMsg);
    localDebugLogs.push(errorMsg);
    return { results: [], debugLogs: localDebugLogs };
  }

  const googleQuery = `${userQuestion} site:reddit.com`;
  // Match the cURL structure including results, advance_search, ai_overview, and country
  const apiUrl = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&q=${encodeURIComponent(googleQuery)}&page=0&country=us&results=10&advance_search=false&ai_overview=false`;

  const fetchingMsg = `[Experimental Reddit] Constructed Scrapingdog API URL: ${apiUrl}`;
  console.log(fetchingMsg);
  localDebugLogs.push(fetchingMsg);

  try {
    const { data } = await axios.get<ScrapingdogGoogleResponse>(apiUrl);
    
    const rawResponseLog = `[Experimental Reddit] Raw FULL JSON response from Scrapingdog: ${JSON.stringify(data, null, 2)}`;
    console.log(rawResponseLog); // Log to server console
    localDebugLogs.push(rawResponseLog); // Add to logs sent to client

    if (data.error) {
      const apiErrorMsg = `[Experimental Reddit] Scrapingdog API returned an error: ${data.error}`;
      console.error(apiErrorMsg);
      localDebugLogs.push(apiErrorMsg);
      return { results: [], debugLogs: localDebugLogs };
    }

    if (!data.organic_results || data.organic_results.length === 0) {
      const noResultsMsg = `[Experimental Reddit] No organic_results found in Scrapingdog response for query: "${googleQuery}"`;
      console.warn(noResultsMsg);
      localDebugLogs.push(noResultsMsg);
      return { results: [], debugLogs: localDebugLogs };
    }
    
    // Filter for actual Reddit links BEFORE returning
    const redditResults = data.organic_results.filter(r => r.link && r.link.toLowerCase().includes('reddit.com'));
    const filteredResultsLog = `[Experimental Reddit] Filtered for 'reddit.com' links (count: ${redditResults.length}): ${JSON.stringify(redditResults.map(r => r.link).slice(0,5), null, 2)}`; // Log first 5 links
    console.log(filteredResultsLog);
    localDebugLogs.push(filteredResultsLog);
    
    return { results: redditResults, debugLogs: localDebugLogs };

  } catch (err: any) {
    const errorMsgPrefix = `[Experimental Reddit] Axios error during Scrapingdog API call to ${apiUrl}:`;
    let detailedError = err.message;
    if (axios.isAxiosError(err)) {
        detailedError = `${err.message}${err.response ? ` | Status: ${err.response.status} | Data: ${JSON.stringify(err.response.data)}` : ''}`;
    }
    const fullErrorLog = `${errorMsgPrefix} ${detailedError}`;
    console.error(fullErrorLog, err);
    localDebugLogs.push(fullErrorLog);
    return { results: [], debugLogs: localDebugLogs };
  }
}

// Robust post ID extractor (case-insensitive for post ID part)
function extractPostIdFromUrl(url: string): string | null {
  // Matches /comments/POST_ID/ or /comments/POST_ID (at end of URL)
  // POST_ID can be alphanumeric.
  const match = url.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i);
  return match ? match[1] : null;
}

export async function searchAndFetchFullRedditPosts(userQuestion: string, resultLimit: number = 3): Promise<SearchAndFetchReturn> {
  let cumulativeDebugLogs: string[] = [];
  const startingSearchMsg = `[Experimental Reddit] Starting searchAndFetchFullRedditPosts for userQuery: "${userQuestion}", resultLimit: ${resultLimit}`;
  console.log(startingSearchMsg);
  cumulativeDebugLogs.push(startingSearchMsg);

  try {
    const { results: googleResults, debugLogs: searchDebugLogs } = await fetchGoogleSearchResults(userQuestion);
    cumulativeDebugLogs.push(...searchDebugLogs);

    if (googleResults.length === 0) {
      const noGoogleResultsMsg = "[Experimental Reddit] No relevant Reddit results from Google search (after filtering) to process further.";
      console.log(noGoogleResultsMsg);
      cumulativeDebugLogs.push(noGoogleResultsMsg);
      return { summary: "No relevant Reddit discussions found via Google search for your query (empty or non-Reddit links returned).", debugLogs: cumulativeDebugLogs };
    }

    const topResultsToProcess = googleResults.slice(0, resultLimit);
    const processingTopMsg = `[Experimental Reddit] Processing top ${topResultsToProcess.length} filtered Google results for Reddit links.`;
    console.log(processingTopMsg);
    cumulativeDebugLogs.push(processingTopMsg);

    let summary = `Based on Reddit discussions (found via Google) related to your query "${userQuestion}":\n\n`;
    let postsProcessedSuccessfully = 0;
    let firstCommentErrorDetail: string | null = null;

    for (const result of topResultsToProcess) {
      const processingResultMsg = `[Experimental Reddit] Processing Google result: Title: "${result.title}", Link: "${result.link}"`;
      console.log(processingResultMsg);
      cumulativeDebugLogs.push(processingResultMsg);

      const postIdBase = extractPostIdFromUrl(result.link);
      
      if (!postIdBase) {
        const noIdMsg = `[Experimental Reddit] Could not extract valid Reddit post ID from URL: ${result.link}. Skipping this link.`;
        console.warn(noIdMsg);
        cumulativeDebugLogs.push(noIdMsg);
        summary += `Skipped processing link (invalid Reddit post URL): ${result.link}\n\n`;
        continue;
      }

      const postFullName = `t3_${postIdBase}`; 
      const fetchingCommentsMsg = `[Experimental Reddit] Attempting to fetch comments for post: ${postFullName} (Original Link: ${result.link}, Title: ${result.title})`;
      console.log(fetchingCommentsMsg);
      cumulativeDebugLogs.push(fetchingCommentsMsg);

      try {
        const { comments, debugLogs: commentFetchLogs } = await fetchPostComments(postFullName, 2); // Fetch top 2 comments
        cumulativeDebugLogs.push(...commentFetchLogs.map(log => `[CommentFetch for ${postFullName}] ${log}`));


        if (comments.length === 0 && commentFetchLogs.some(log => log.includes("Error") || log.includes("Failed"))) {
           const commentFetchErrorMsg = `[Experimental Reddit] Fetch comments failed for ${postFullName}. Logs indicate error.`;
           console.warn(commentFetchErrorMsg);
           cumulativeDebugLogs.push(commentFetchErrorMsg);
           summary += `Post: "${result.title}" (from ${result.link})\n  Could not fetch comments for this post (see server logs for details or previous debug messages).\n\n`;
            if (!firstCommentErrorDetail) {
               firstCommentErrorDetail = `Failed fetching comments for post "${result.title}" (ID: ${postFullName}). Related logs: ${commentFetchLogs.filter(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('fail')).join('; ')}`;
            }
           continue; // Skip to next post if comments failed to fetch
        }
        
        const fetchedCommentsLog = `[Experimental Reddit] Successfully fetched ${comments.length} comments for post ${postFullName}.`;
        console.log(fetchedCommentsLog);
        cumulativeDebugLogs.push(fetchedCommentsLog);

        summary += `Post: "${result.title}" (from ${result.link})\n`;
        if (result.snippet) {
             summary += `  Snippet from Google: ${result.snippet.substring(0,200).trim()}...\n`;
        }

        if (comments.length > 0) {
          summary += `  Top Comments:\n`;
          comments.forEach(comment => {
            summary += `    - "${comment.body.substring(0, 150).trim()}${comment.body.length > 150 ? '...' : ''}" (Score: ${comment.score})\n`;
          });
        } else {
          summary += `  No relevant comments found for this post.\n`;
          cumulativeDebugLogs.push(`[Experimental Reddit] No comments (or none after filtering) found for post ${postFullName}.`);
        }
        summary += "\n";
        postsProcessedSuccessfully++;

      } catch (commentError: any) {
        let errorDetailForSummary = commentError.message || "Unknown error fetching comments";
        let fullResponseDataErrorString = "";

        if (axios.isAxiosError(commentError) && commentError.response && commentError.response.data) {
            const redditErrorData = commentError.response.data;
            fullResponseDataErrorString = JSON.stringify(redditErrorData);
            const redditApiMsg = redditErrorData?.message || redditErrorData?.error_description || redditErrorData?.error;
            errorDetailForSummary = `Reddit API Error (${commentError.response.status}): ${redditApiMsg}. Full Response: ${fullResponseDataErrorString}`;
        } else {
            errorDetailForSummary = commentError.toString();
        }
        
        const commentFetchErrorMsg = `[Experimental Reddit] CATCH BLOCK: Error fetching comments for post ${postFullName} (Title: ${result.title}): ${errorDetailForSummary}`;
        console.error(commentFetchErrorMsg);
        cumulativeDebugLogs.push(commentFetchErrorMsg);

        if (!firstCommentErrorDetail) {
          firstCommentErrorDetail = `Failed on post "${result.title}": ${errorDetailForSummary}`;
        }
        summary += `Post: "${result.title}" (from ${result.link})\n  Could not fetch comments for this post. Error: ${errorDetailForSummary.substring(0, 350)}${errorDetailForSummary.length > 350 ? '...' : ''}\n\n`;
      }
    }

    if (postsProcessedSuccessfully === 0 && topResultsToProcess.length > 0) {
        const baseMessage = "Found Reddit posts via Google, but encountered issues fetching their content or no comments were found for them.";
        const finalMessage = firstCommentErrorDetail ? `${baseMessage} First error detail encountered: ${firstCommentErrorDetail}` : baseMessage;
        console.log(`[Experimental Reddit] No posts processed successfully with comments. Returning: "${finalMessage}"`);
        cumulativeDebugLogs.push(`[Experimental Reddit] No posts processed successfully with comments. Final message to user: "${finalMessage}"`);
        return { summary: finalMessage, debugLogs: cumulativeDebugLogs };
    }
    if (postsProcessedSuccessfully === 0 && topResultsToProcess.length === 0) { 
        const noProcessedMsg = "[Experimental Reddit] No posts processed because no relevant Reddit links were found after Google search and filtering.";
        console.log(noProcessedMsg);
        cumulativeDebugLogs.push(noProcessedMsg);
        return { summary: "No relevant Reddit discussions found via Google search for your query.", debugLogs: cumulativeDebugLogs };
    }

    const finalSummaryMsg = `[Experimental Reddit] Final summary constructed with ${postsProcessedSuccessfully} posts. Length: ${summary.trim().length}`;
    console.log(finalSummaryMsg);
    cumulativeDebugLogs.push(finalSummaryMsg);
    return { summary: summary.trim(), debugLogs: cumulativeDebugLogs };

  } catch (error: any) {
    const generalErrorMsg = `[Experimental Reddit] CRITICAL Error in searchAndFetchFullRedditPosts: ${error.message}`;
    console.error(generalErrorMsg, error.stack);
    cumulativeDebugLogs.push(generalErrorMsg);
    if (error.stack) {
        cumulativeDebugLogs.push(`[Experimental Reddit] CRITICAL Stack: ${error.stack.substring(0,300)}...`);
    }
    return { 
      summary: `Sorry, I encountered a critical error trying to fetch and process Reddit content via Google: ${error.message.substring(0,250)}`,
      debugLogs: cumulativeDebugLogs
    };
  }
}

    