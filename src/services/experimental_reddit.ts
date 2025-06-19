
'use server';

import axios from 'axios';

// Interface for the structure of Google organic results from Scrapingdog
interface GoogleOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  position?: number;
  rank?: number; // Scrapingdog sometimes uses rank
}

// Interface for the expected overall response from Scrapingdog Google Search API
interface ScrapingdogGoogleResponse {
  search_information?: {
    total_results?: string;
    time_taken_displayed?: string;
    query_displayed?: string;
  };
  organic_results?: GoogleOrganicResult[];
  error?: string; // To catch API-level errors from Scrapingdog
  // pagination and other fields might exist but are not used currently
}

// Return type for fetchGoogleSearchResults, including debug logs
interface FetchGoogleResultsReturn {
  results: GoogleOrganicResult[];
  debugLogs: string[];
}

// Return type for the main exported function, including debug logs
interface FetchTopLinksReturn {
  summary: string;
  debugLogs: string[];
}

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

// Function to fetch Google search results using Scrapingdog
async function fetchGoogleSearchResults(userQuestion: string): Promise<FetchGoogleResultsReturn> {
  const localDebugLogs: string[] = [];
  localDebugLogs.push(`[Experimental Reddit] Entered fetchGoogleSearchResults for userQuestion: "${userQuestion}"`);

  if (!SCRAPINGDOG_API_KEY) {
    const errorMsg = "[Experimental Reddit] Scrapingdog API Key not configured.";
    console.error(errorMsg); // Server log
    localDebugLogs.push(errorMsg);
    return { results: [], debugLogs: localDebugLogs };
  }

  const googleQuery = `${userQuestion} site:reddit.com`;
  // Ensure the query parameter is 'query' and not 'q'
  const apiUrl = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&query=${encodeURIComponent(googleQuery)}&page=0&country=us&results=10&advance_search=false&ai_overview=false`;

  const fetchingMsg = `[Experimental Reddit] Constructed Scrapingdog API URL: ${apiUrl}`;
  console.log(fetchingMsg); // Server log
  localDebugLogs.push(fetchingMsg);

  try {
    localDebugLogs.push(`[Experimental Reddit] Attempting to call Scrapingdog API with a browser-like User-Agent...`);
    
    // Define a common browser User-Agent
    const browserUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    const { data } = await axios.get<ScrapingdogGoogleResponse>(apiUrl, {
      headers: {
        'User-Agent': browserUserAgent,
      }
    });
    localDebugLogs.push(`[Experimental Reddit] Scrapingdog API call completed.`);

    const rawResponseLog = `[Experimental Reddit] Raw FULL JSON response from Scrapingdog: ${JSON.stringify(data, null, 2)}`;
    console.log(rawResponseLog); // Server log for Vercel/local terminal
    localDebugLogs.push(rawResponseLog); // For chatbot UI debugging

    if (data.error) {
      const apiErrorMsg = `[Experimental Reddit] Scrapingdog API returned an error in response: ${data.error}`;
      console.error(apiErrorMsg); // Server log
      localDebugLogs.push(apiErrorMsg);
      return { results: [], debugLogs: localDebugLogs };
    }

    if (!data.organic_results) {
      const noResultsMsg = `[Experimental Reddit] No 'organic_results' field found in Scrapingdog response for query: "${googleQuery}". This might indicate an issue with the query or API response structure.`;
      console.warn(noResultsMsg); // Server log
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
    console.error(fullErrorLog, err); // Server log
    localDebugLogs.push(fullErrorLog);
    return { results: [], debugLogs: localDebugLogs };
  }
}

// Main function to be called by the API route
// This version focuses on getting the top 3 Google search results (links) via Scrapingdog
export async function fetchTopGoogleRedditLinksAndDebug(userQuery: string, resultLimit: number = 3): Promise<FetchTopLinksReturn> {
  let cumulativeDebugLogs: string[] = [];
  const startingSearchMsg = `[Experimental Reddit] Starting fetchTopGoogleRedditLinksAndDebug for userQuery: "${userQuery}", resultLimit: ${resultLimit}`;
  console.log(startingSearchMsg); // Server log
  cumulativeDebugLogs.push(startingSearchMsg);

  try {
    const { results: googleResults, debugLogs: searchDebugLogs } = await fetchGoogleSearchResults(userQuery);
    cumulativeDebugLogs.push(...searchDebugLogs);

    if (!googleResults || googleResults.length === 0) {
      const noGoogleResultsMsg = "[Experimental Reddit] No Google results returned from fetchGoogleSearchResults to process further.";
      console.log(noGoogleResultsMsg); // Server log
      cumulativeDebugLogs.push(noGoogleResultsMsg);
      return { summary: "Scrapingdog/Google search returned no organic results for your query.", debugLogs: cumulativeDebugLogs };
    }
    
    // Filter for actual Reddit links
    const redditSiteLinks = googleResults.filter(r => r.link && r.link.toLowerCase().includes('reddit.com'));
    cumulativeDebugLogs.push(`[Experimental Reddit] Filtered Reddit-specific results from Google (count: ${redditSiteLinks.length}): ${JSON.stringify(redditSiteLinks.map(r => r.link))}`);

    if (redditSiteLinks.length === 0) {
      const noRedditLinksMsg = "[Experimental Reddit] No Reddit.com links found in the Google search results after filtering.";
      console.log(noRedditLinksMsg); // Server log
      cumulativeDebugLogs.push(noRedditLinksMsg);
      return { summary: "No Reddit.com links found in the Google search results for your query.", debugLogs: cumulativeDebugLogs };
    }

    const topLinksToReturn = redditSiteLinks.slice(0, resultLimit).map(r => r.link);
    cumulativeDebugLogs.push(`[Experimental Reddit] Top ${topLinksToReturn.length} Reddit links extracted for summary: ${JSON.stringify(topLinksToReturn)}`);

    let summary = `Top ${topLinksToReturn.length} Reddit links found via Google for your query "${userQuery}":\n`;
    if (topLinksToReturn.length > 0) {
      topLinksToReturn.forEach((link, index) => {
        summary += `${index + 1}. ${link}\n`;
      });
    } else {
      summary = "No relevant Reddit links were found in the top Google search results to list.";
       cumulativeDebugLogs.push("[Experimental Reddit] No links to list in summary as topLinksToReturn is empty after slicing.");
    }
    
    const finalSummaryMsg = `[Experimental Reddit] Final summary constructed (just links). Length: ${summary.trim().length}`;
    console.log(finalSummaryMsg); // Server log
    cumulativeDebugLogs.push(finalSummaryMsg);
    return { summary: summary.trim(), debugLogs: cumulativeDebugLogs };

  } catch (error: any) {
    const generalErrorMsg = `[Experimental Reddit] CRITICAL Error in fetchTopGoogleRedditLinksAndDebug: ${error.message}`;
    console.error(generalErrorMsg, error.stack); // Server log
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
