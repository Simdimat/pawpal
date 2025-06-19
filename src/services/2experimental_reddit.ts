'use server';

import axios from 'axios';

// Interfaces
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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/91.0.4472.124 Safari/537.36';

async function fetchGoogleSearchResults(
  userQuestion: string,
  localDebugLogs: string[]
): Promise<FetchGoogleResultsReturnEnhanced> {
  localDebugLogs.push(
    `[Experimental Reddit] fetchGoogleSearchResults received original userQuestion: "${userQuestion}"`
  );

  if (!SCRAPINGDOG_API_KEY) {
    const errorMsg = "[Experimental Reddit] Scrapingdog API Key not configured.";
    console.error(errorMsg);
    localDebugLogs.push(errorMsg);
    return { results: [], debugLogs: localDebugLogs };
  }

  // Ensure userQuestion is lowercased before constructing the query
  const lowerUserQuestion = userQuestion.toLowerCase();
  localDebugLogs.push(
    `[Experimental Reddit] userQuestion after toLowerCase(): "${lowerUserQuestion}"`
  );

  const googleQueryString = `${lowerUserQuestion} site:reddit.com`;
  localDebugLogs.push(
    `[Experimental Reddit] Full googleQueryString for Scrapingdog (pre-encoding): "${googleQueryString}"`
  );

  const encodedGoogleQueryString = encodeURIComponent(googleQueryString);
  localDebugLogs.push(
    `[Experimental Reddit] Encoded googleQueryString for URL: "${encodedGoogleQueryString}"`
  );

  const apiUrl = `https://api.scrapingdog.com/google` +
    `?api_key=${SCRAPINGDOG_API_KEY}` +
    `&query=${encodedGoogleQueryString}` + // Ensure this is `query`
    `&page=0&country=us&results=10&advance_search=false&ai_overview=false`;
  localDebugLogs.push(
    `[Experimental Reddit] Final Constructed Scrapingdog API URL: ${apiUrl}`
  );

  localDebugLogs.push(
    `[Experimental Reddit] Attempting to call Scrapingdog API with a browser-like User-Agent...`
  );

  try {
    const { data } = await axios.get<ScrapingdogGoogleResponse>(apiUrl, {
      headers: { 'User-Agent': browserUserAgent },
    });
    localDebugLogs.push(`[Experimental Reddit] Scrapingdog API call completed.`);

    localDebugLogs.push(
      `[Experimental Reddit] Raw FULL JSON response from Scrapingdog: ${JSON.stringify(
        data,
        null,
        2
      )}`
    );

    if (data.error) {
      const apiErrorMsg = `[Experimental Reddit] Scrapingdog API returned an error: ${data.error}`;
      localDebugLogs.push(apiErrorMsg);
      return { results: [], debugLogs: localDebugLogs };
    }

    if (!data.organic_results) {
      const noResultsMsg = `[Experimental Reddit] No 'organic_results' field found in Scrapingdog response.`;
      localDebugLogs.push(noResultsMsg);
      return { results: [], debugLogs: localDebugLogs };
    }

    localDebugLogs.push(
      `[Experimental Reddit] 'organic_results' length: ${data.organic_results.length}.`
    );
    return { results: data.organic_results, debugLogs: localDebugLogs };
  } catch (err: any) {
    let detailedError = err.message;
    if (axios.isAxiosError(err)) {
      detailedError = `${err.message}${
        err.response
          ? ` | Status: ${err.response.status} | Data: ${JSON.stringify(
              err.response.data
            )}`
          : ''
      }`;
    }
    const fullErrorLog = `[Experimental Reddit] Axios error during Scrapingdog API call to ${apiUrl}: ${detailedError}`;
    localDebugLogs.push(fullErrorLog);
    return { results: [], debugLogs: localDebugLogs };
  }
}

export async function fetchTopGoogleRedditLinksAndDebug(
  userQuery: string,
  resultLimit = 3
): Promise<FetchTopLinksReturn> {
  const cumulativeDebugLogs: string[] = [];
  cumulativeDebugLogs.push(
    `[Experimental Reddit] Starting fetchTopGoogleRedditLinksAndDebug for userQuery: "${userQuery}", resultLimit: ${resultLimit}`
  );

  try {
    const {
      results: googleResults,
      debugLogs: searchDebugLogs, // searchDebugLogs are already part of cumulativeDebugLogs
    } = await fetchGoogleSearchResults(userQuery, cumulativeDebugLogs);

    if (!googleResults || googleResults.length === 0) {
      cumulativeDebugLogs.push(
        "[Experimental Reddit] No Google results returned from fetchGoogleSearchResults to process further."
      );
      return {
        summary: "Scrapingdog/Google search returned no organic results for your query.",
        debugLogs: cumulativeDebugLogs,
      };
    }

    // Log the raw organic results (first 3 for brevity in UI, but full log in Vercel)
    cumulativeDebugLogs.push(
      `[Experimental Reddit] Raw organic_results from Scrapingdog (first 3 for UI): ${JSON.stringify(
        googleResults.slice(0, 3),
        null,
        2
      )}`
    );
     // Full log for server-side
    console.log(`[Experimental Reddit Service] Full organic_results from Scrapingdog: ${JSON.stringify(googleResults, null, 2)}`);


    const redditSiteLinks = googleResults
      .filter((r) => r.link && r.link.toLowerCase().includes("reddit.com"))
      .map((r) => r.link);

    cumulativeDebugLogs.push(
      `[Experimental Reddit] Filtered Reddit-specific links (count: ${redditSiteLinks.length}): ${JSON.stringify(
        redditSiteLinks
      )}`
    );

    if (!redditSiteLinks.length) {
      cumulativeDebugLogs.push(
        "[Experimental Reddit] No reddit.com links found after filtering."
      );
      return {
        summary: "No Reddit.com links found in the Google search results for your query.",
        debugLogs: cumulativeDebugLogs,
      };
    }

    const topLinksToReturn = redditSiteLinks.slice(0, resultLimit);
    cumulativeDebugLogs.push(
      `[Experimental Reddit] Top ${topLinksToReturn.length} Reddit links extracted for summary: ${JSON.stringify(
        topLinksToReturn
      )}`
    );

    let summary = `Top ${topLinksToReturn.length} Reddit links found via Google for your query "${userQuery}":\n`;
    if (topLinksToReturn.length > 0) {
      topLinksToReturn.forEach((link, index) => {
        summary += `${index + 1}. ${link}\n`;
      });
    } else {
      summary = "No relevant Reddit links were found in the top Google search results to list.";
      cumulativeDebugLogs.push("[Experimental Reddit] No links to list in summary as topLinksToReturn is empty after slicing.");
    }

    cumulativeDebugLogs.push(
      `[Experimental Reddit] Final summary constructed (just links). Length: ${summary.trim().length}`
    );
    return { summary: summary.trim(), debugLogs: cumulativeDebugLogs };

  } catch (error: any) {
    cumulativeDebugLogs.push(
      `[Experimental Reddit] CRITICAL Error in fetchTopGoogleRedditLinksAndDebug: ${error.message}`
    );
    if (error.stack) {
      cumulativeDebugLogs.push(
        `[Experimental Reddit] Stack trace: ${error.stack.substring(0, 300)}...`
      );
    }
    return {
      summary: `Error fetching Reddit links via Google: ${error.message}`,
      debugLogs: cumulativeDebugLogs,
    };
  }
}
