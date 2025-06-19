
'use server';

import axios from 'axios';
// Removed: import { fetchPostComments, type RedditComment } from '@/services/reddit';

interface GoogleOrganicResult {
  title: string;
  link: string;
  snippet: string;
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
}

interface FetchGoogleResultsReturn {
  results: GoogleOrganicResult[];
  debugLogs: string[];
}

interface FetchTopLinksReturn {
  summary: string;
  debugLogs: string[];
}

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

async function fetchGoogleSearchResults(userQuestion: string): Promise<FetchGoogleResultsReturn> {
  const localDebugLogs: string[] = [];
  localDebugLogs.push(`[Experimental Reddit] Entered fetchGoogleSearchResults for userQuestion: "${userQuestion}"`);

  if (!SCRAPINGDOG_API_KEY) {
    const errorMsg = "[Experimental Reddit] Scrapingdog API Key not configured.";
    console.error(errorMsg);
    localDebugLogs.push(errorMsg);
    return { results: [], debugLogs: localDebugLogs };
  }

  const googleQuery = `${userQuestion} site:reddit.com`;
  // Ensure the URL matches the working cURL structure.
  const apiUrl = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&q=${encodeURIComponent(googleQuery)}&page=0&country=us&results=10&advance_search=false&ai_overview=false`;

  const fetchingMsg = `[Experimental Reddit] Constructed Scrapingdog API URL: ${apiUrl}`;
  console.log(fetchingMsg);
  localDebugLogs.push(fetchingMsg);

  try {
    localDebugLogs.push(`[Experimental Reddit] Attempting to call Scrapingdog API...`);
    const { data } = await axios.get<ScrapingdogGoogleResponse>(apiUrl);
    localDebugLogs.push(`[Experimental Reddit] Scrapingdog API call completed.`);

    const rawResponseLog = `[Experimental Reddit] Raw FULL JSON response from Scrapingdog: ${JSON.stringify(data, null, 2)}`;
    console.log(rawResponseLog);
    localDebugLogs.push(rawResponseLog);

    if (data.error) {
      const apiErrorMsg = `[Experimental Reddit] Scrapingdog API returned an error in response: ${data.error}`;
      console.error(apiErrorMsg);
      localDebugLogs.push(apiErrorMsg);
      return { results: [], debugLogs: localDebugLogs };
    }

    if (!data.organic_results) {
      const noResultsMsg = `[Experimental Reddit] No 'organic_results' field found in Scrapingdog response for query: "${googleQuery}".`;
      console.warn(noResultsMsg);
      localDebugLogs.push(noResultsMsg);
      return { results: [], debugLogs: localDebugLogs };
    }
    
    localDebugLogs.push(`[Experimental Reddit] 'organic_results' field found. Count: ${data.organic_results.length}.`);
    return { results: data.organic_results, debugLogs: localDebugLogs };

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

// Renamed and simplified function for this debugging step
export async function fetchTopGoogleRedditLinksAndDebug(userQuestion: string, resultLimit: number = 3): Promise<FetchTopLinksReturn> {
  let cumulativeDebugLogs: string[] = [];
  const startingSearchMsg = `[Experimental Reddit] Starting fetchTopGoogleRedditLinksAndDebug for userQuery: "${userQuestion}", resultLimit: ${resultLimit}`;
  console.log(startingSearchMsg);
  cumulativeDebugLogs.push(startingSearchMsg);

  try {
    const { results: googleResults, debugLogs: searchDebugLogs } = await fetchGoogleSearchResults(userQuestion);
    cumulativeDebugLogs.push(...searchDebugLogs);

    if (!googleResults || googleResults.length === 0) {
      const noGoogleResultsMsg = "[Experimental Reddit] No Google results returned from fetchGoogleSearchResults to process further.";
      console.log(noGoogleResultsMsg);
      cumulativeDebugLogs.push(noGoogleResultsMsg);
      return { summary: "Scrapingdog/Google search returned no organic results for your query.", debugLogs: cumulativeDebugLogs };
    }

    cumulativeDebugLogs.push(`[Experimental Reddit] Received ${googleResults.length} organic results from Scrapingdog. Filtering for Reddit links...`);

    const redditResults = googleResults.filter(r => r.link && r.link.toLowerCase().includes('reddit.com'));
    cumulativeDebugLogs.push(`[Experimental Reddit] Filtered down to ${redditResults.length} Reddit-specific results. Links: ${JSON.stringify(redditResults.map(r => r.link))}`);

    if (redditResults.length === 0) {
      const noRedditLinksMsg = "[Experimental Reddit] No Reddit.com links found in the Google search results after filtering.";
      console.log(noRedditLinksMsg);
      cumulativeDebugLogs.push(noRedditLinksMsg);
      return { summary: "No Reddit.com links found in the Google search results for your query.", debugLogs: cumulativeDebugLogs };
    }

    const topLinksToReturn = redditResults.slice(0, resultLimit).map(r => r.link);
    cumulativeDebugLogs.push(`[Experimental Reddit] Top ${topLinksToReturn.length} Reddit links extracted: ${JSON.stringify(topLinksToReturn)}`);

    let summary = `Top ${topLinksToReturn.length} Reddit links found via Google for your query "${userQuestion}":\n`;
    if (topLinksToReturn.length > 0) {
      topLinksToReturn.forEach((link, index) => {
        summary += `${index + 1}. ${link}\n`;
      });
    } else {
      summary = "No relevant Reddit links were found in the top Google search results.";
       cumulativeDebugLogs.push("[Experimental Reddit] No links to list in summary as topLinksToReturn is empty after slicing.");
    }
    
    const finalSummaryMsg = `[Experimental Reddit] Final summary constructed with links. Length: ${summary.trim().length}`;
    console.log(finalSummaryMsg);
    cumulativeDebugLogs.push(finalSummaryMsg);
    return { summary: summary.trim(), debugLogs: cumulativeDebugLogs };

  } catch (error: any) {
    const generalErrorMsg = `[Experimental Reddit] CRITICAL Error in fetchTopGoogleRedditLinksAndDebug: ${error.message}`;
    console.error(generalErrorMsg, error.stack);
    cumulativeDebugLogs.push(generalErrorMsg);
    if (error.stack) {
        cumulativeDebugLogs.push(`[Experimental Reddit] CRITICAL Stack: ${error.stack.substring(0,300)}...`);
    }
    return { 
      summary: `Sorry, I encountered a critical error trying to fetch and process Reddit links via Google: ${error.message.substring(0,250)}`,
      debugLogs: cumulativeDebugLogs
    };
  }
}
