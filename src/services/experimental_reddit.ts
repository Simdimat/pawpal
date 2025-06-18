
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
    // Removed direct throw to allow propagation of debug log
    return { results: [], debugLogs: localDebugLogs };
  }
  const query = `${userQuestion} site:reddit.com`;
  const url = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&q=${encodeURIComponent(query)}&page=0&location=United+States`;

  const fetchingMsg = `[Experimental Reddit] Fetching Google search results from Scrapingdog for query: "${query}"`;
  console.log(fetchingMsg);
  localDebugLogs.push(fetchingMsg);

  try {
    const { data } = await axios.get<ScrapingdogGoogleResponse>(url);
    
    const rawResultsLog = `[Experimental Reddit] Raw organic_results from Scrapingdog: ${JSON.stringify(data.organic_results?.slice(0,3) || [], null, 2)}`; // Log first 3 for brevity
    console.log(rawResultsLog);
    localDebugLogs.push(rawResultsLog);


    if (!data.organic_results || data.organic_results.length === 0) {
      const noResultsMsg = `[Experimental Reddit] No organic results found by Scrapingdog for: ${query}`;
      console.warn(noResultsMsg);
      localDebugLogs.push(noResultsMsg);
      return { results: [], debugLogs: localDebugLogs };
    }
    
    const redditResults = data.organic_results.filter(r => r.link && r.link.includes('reddit.com'));
    const filteredResultsLog = `[Experimental Reddit] Filtered Reddit-specific results (count: ${redditResults.length}): ${JSON.stringify(redditResults.map(r => r.link).slice(0,3), null, 2)}`;
    console.log(filteredResultsLog);
    localDebugLogs.push(filteredResultsLog);
    
    return { results: redditResults, debugLogs: localDebugLogs };

  } catch (err: any) {
    const errorMsg = `[Experimental Reddit] Scrapingdog API error during Google search: ${err.response?.data?.message || err.message}`;
    console.error(errorMsg, err.response?.data || err);
    localDebugLogs.push(errorMsg);
    if (err.response?.data) {
        const detailError = `[Experimental Reddit] Scrapingdog error details: ${JSON.stringify(err.response.data)}`;
        console.error(detailError);
        localDebugLogs.push(detailError);
    }
    return { results: [], debugLogs: localDebugLogs };
  }
}

function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/comments\/([a-zA-Z0-9]+)(?:\/|$)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

export async function searchAndFetchFullRedditPosts(userQuestion: string, resultLimit: number = 2): Promise<SearchAndFetchReturn> {
  let cumulativeDebugLogs: string[] = [];
  const startingSearchMsg = `[Experimental Reddit] Starting searchAndFetchFullRedditPosts for query: "${userQuestion}", limit: ${resultLimit}`;
  console.log(startingSearchMsg);
  cumulativeDebugLogs.push(startingSearchMsg);

  try {
    const { results: googleResults, debugLogs: searchDebugLogs } = await fetchGoogleSearchResults(userQuestion);
    cumulativeDebugLogs.push(...searchDebugLogs);

    if (googleResults.length === 0) {
      const noGoogleResultsMsg = "[Experimental Reddit] No Reddit results from Google search to process further.";
      console.log(noGoogleResultsMsg);
      cumulativeDebugLogs.push(noGoogleResultsMsg);
      return { summary: "No relevant Reddit discussions found via Google search for your query.", debugLogs: cumulativeDebugLogs };
    }

    const topResults = googleResults.slice(0, resultLimit);
    const processingTopMsg = `[Experimental Reddit] Processing top ${topResults.length} Google results for Reddit links.`;
    console.log(processingTopMsg);
    cumulativeDebugLogs.push(processingTopMsg);

    let summary = `Based on Reddit discussions (found via Google) related to your query "${userQuestion}":\n\n`;
    let postsProcessed = 0;
    let firstCommentErrorDetail: string | null = null;

    for (const result of topResults) {
      const processingResultMsg = `[Experimental Reddit] Processing Google result: Title: "${result.title}", Link: "${result.link}"`;
      console.log(processingResultMsg);
      cumulativeDebugLogs.push(processingResultMsg);

      const postIdBase = extractPostIdFromUrl(result.link);
      
      if (!postIdBase) {
        const noIdMsg = `[Experimental Reddit] Could not extract post ID from URL: ${result.link}`;
        console.warn(noIdMsg);
        cumulativeDebugLogs.push(noIdMsg);
        summary += `Could not process link: ${result.link} (Failed to extract post ID)\n`;
        continue;
      }

      const postFullName = `t3_${postIdBase}`; 
      const fetchingCommentsMsg = `[Experimental Reddit] Attempting to fetch comments for post: ${postFullName} (Title: ${result.title})`;
      console.log(fetchingCommentsMsg);
      cumulativeDebugLogs.push(fetchingCommentsMsg);

      try {
        const comments: RedditComment[] = await fetchPostComments(postFullName, 2); 
        const fetchedCommentsMsg = `[Experimental Reddit] Successfully fetched ${comments.length} comments for post ${postFullName}.`;
        console.log(fetchedCommentsMsg);
        cumulativeDebugLogs.push(fetchedCommentsMsg);

        summary += `Post: "${result.title}"\n`;
        if (result.snippet) {
             summary += `  Snippet from Google: ${result.snippet.substring(0,150)}...\n`;
        }

        if (comments.length > 0) {
          summary += `  Top Comments:\n`;
          comments.forEach(comment => {
            summary += `    - "${comment.body.substring(0, 100).trim()}${comment.body.length > 100 ? '...' : ''}" (Score: ${comment.score})\n`;
          });
        } else {
          summary += `  No comments found or comments could not be retrieved for this post.\n`;
          cumulativeDebugLogs.push(`[Experimental Reddit] No comments found for post ${postFullName}.`);
        }
        summary += "\n";
        postsProcessed++;
      } catch (commentError: any) {
        let errorDetail = commentError.message || "Unknown error fetching comments";
        let fullResponseData = "";

        if (axios.isAxiosError(commentError) && commentError.response && commentError.response.data) {
            const redditErrorMsg = commentError.response.data?.message || commentError.response.data?.error_description || commentError.response.data?.error;
            fullResponseData = JSON.stringify(commentError.response.data);
            errorDetail = `Reddit API Error (${commentError.response.status}): ${redditErrorMsg}. Full Response: ${fullResponseData}`;
        } else {
            errorDetail = commentError.toString();
        }
        
        const commentFetchErrorMsg = `[Experimental Reddit] Error fetching comments for post ${postFullName} (Title: ${result.title}): ${errorDetail}`;
        console.error(commentFetchErrorMsg);
        cumulativeDebugLogs.push(commentFetchErrorMsg);

        if (!firstCommentErrorDetail) {
          firstCommentErrorDetail = `Failed on post "${result.title}": ${errorDetail}`;
        }
        summary += `Post: "${result.title}"\n  Could not fetch comments for this post (Error: ${errorDetail.substring(0, 350)}${errorDetail.length > 350 ? '...' : ''}).\n\n`;
      }
    }

    if (postsProcessed === 0 && topResults.length > 0) {
        const baseMessage = "Found Reddit posts via Google, but encountered issues fetching their content.";
        const finalMessage = firstCommentErrorDetail ? `${baseMessage} First error detail: ${firstCommentErrorDetail}` : baseMessage;
        console.log(`[Experimental Reddit] No posts processed successfully. Returning: "${finalMessage}"`);
        cumulativeDebugLogs.push(`[Experimental Reddit] No posts processed successfully. Final message to user: "${finalMessage}"`);
        return { summary: finalMessage, debugLogs: cumulativeDebugLogs };
    }
    if (postsProcessed === 0 && topResults.length === 0) { 
        const noProcessedMsg = "[Experimental Reddit] No posts processed because no Google results were relevant after filtering.";
        console.log(noProcessedMsg);
        cumulativeDebugLogs.push(noProcessedMsg);
        return { summary: "No relevant Reddit discussions found via Google search for your query.", debugLogs: cumulativeDebugLogs };
    }

    const finalSummaryMsg = `[Experimental Reddit] Final summary constructed. Length: ${summary.trim().length}`;
    console.log(finalSummaryMsg);
    cumulativeDebugLogs.push(finalSummaryMsg);
    return { summary: summary.trim(), debugLogs: cumulativeDebugLogs };

  } catch (error: any) {
    const generalErrorMsg = `[Experimental Reddit] Error in searchAndFetchFullRedditPosts: ${error.message}`;
    console.error(generalErrorMsg, error.stack);
    cumulativeDebugLogs.push(generalErrorMsg);
    return { 
      summary: `Sorry, I encountered an error trying to fetch Reddit content: ${error.message.substring(0,250)}`,
      debugLogs: cumulativeDebugLogs
    };
  }
}
