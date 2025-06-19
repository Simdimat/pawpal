
'use server';

import axios from 'axios';

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
  message?: string; // Sometimes errors are in 'message'
  status?: number;  // And include a status
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

  // Using &q= as per ChatGPT's suggestion in the provided code
  const apiUrl = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&q=${encodedGoogleQueryString}&page=0&country=us&results=10&advance_search=false&ai_overview=false`;
  localDebugLogs.push(`[Experimental Reddit] Final Constructed Scrapingdog API URL: ${apiUrl}`);

  const requestConfig = {
    headers: {
      'User-Agent': browserUserAgent,
      // Removed Accept and Accept-Encoding based on previous successful cURL simplicity, and to test minimal headers.
      // Add them back if issues persist with specific values.
      // 'Accept': '*/*',
      // 'Accept-Encoding': 'gzip, deflate, br', 
    },
  };
  localDebugLogs.push(`[Experimental Reddit] Axios request config being used: ${JSON.stringify(requestConfig, null, 2)}`);
  localDebugLogs.push(`[Experimental Reddit] Attempting to call Scrapingdog API with User-Agent: "${browserUserAgent}"...`);

  try {
    const { data } = await axios.get<ScrapingdogGoogleResponse>(apiUrl, requestConfig);
    localDebugLogs.push(`[Experimental Reddit] Scrapingdog API call completed successfully. Status in data: ${data.status || 'N/A (status not in data body)'}`); // Log status from response body if available
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
      detailedError = `${err.message}${err.response ? ` | Status: ${err.response.status} | Data: ${JSON.stringify(err.response.data)}` : ''}`;
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
    // Pass cumulativeDebugLogs to be populated by fetchGoogleSearchResults
    const { results: googleResults, debugLogs: searchDebugLogs } = await fetchGoogleSearchResults(userQuery, cumulativeDebugLogs);
    // Note: searchDebugLogs is the same array as cumulativeDebugLogs and will already contain logs from fetchGoogleSearchResults.

    if (!googleResults || googleResults.length === 0) {
      cumulativeDebugLogs.push("[Experimental Reddit] No Google results returned from fetchGoogleSearchResults to process further.");
      return {
        summary: "Scrapingdog/Google search returned no organic results for your query.",
        debugLogs: cumulativeDebugLogs,
      };
    }
    
    // Log the raw organic results here for clarity (showing first 3 or all if fewer)
    cumulativeDebugLogs.push(`[Experimental Reddit] Raw organic_results received by fetchTopGoogleRedditLinksAndDebug (first ${Math.min(3, googleResults.length)} of ${googleResults.length}): ${JSON.stringify(googleResults.slice(0, 3), null, 2)}`);

    const redditSiteLinks = googleResults
      .filter(r => r.link && r.link.toLowerCase().includes("reddit.com"))
      .map(r => r.link); // Extract just the link string

    cumulativeDebugLogs.push(`[Experimental Reddit] Filtered Reddit-specific results (count: ${redditSiteLinks.length}): ${JSON.stringify(redditSiteLinks)}`);

    if (!redditSiteLinks.length) {
      cumulativeDebugLogs.push("[Experimental Reddit] No reddit.com links found after filtering.");
      return {
        summary: "No Reddit.com links found in the Google search results for your query.",
        debugLogs: cumulativeDebugLogs,
      };
    }

    const topLinksToReturn = redditSiteLinks.slice(0, resultLimit);
    cumulativeDebugLogs.push(`[Experimental Reddit] Top ${topLinksToReturn.length} Reddit links extracted for summary: ${JSON.stringify(topLinksToReturn)}`);

    let summary = `Top ${topLinksToReturn.length} Reddit link(s) found via Google for your query "${userQuery}":\n`;
    if (topLinksToReturn.length > 0) {
      topLinksToReturn.forEach((link, index) => {
        summary += `${index + 1}. ${link}\n`;
      });
    } else {
      // This case should ideally be caught by the check above, but as a fallback:
      summary = "No relevant Reddit links were found in the top Google search results to list.";
      cumulativeDebugLogs.push("[Experimental Reddit] No links to list in summary as topLinksToReturn is empty after slicing.");
    }
    
    cumulativeDebugLogs.push(`[Experimental Reddit] Final summary constructed. Length: ${summary.trim().length}`);
    return { summary: summary.trim(), debugLogs: cumulativeDebugLogs };

  } catch (error: any) {
    cumulativeDebugLogs.push(`[Experimental Reddit] CRITICAL Error in fetchTopGoogleRedditLinksAndDebug: ${error.message}`);
    if (error.stack) {
      cumulativeDebugLogs.push(`[Experimental Reddit] Stack trace: ${error.stack.substring(0, 300)}...`);
    }
    return {
      summary: `Error fetching Reddit links via Google: ${error.message}`,
      debugLogs: cumulativeDebugLogs,
    };
  }
}
    