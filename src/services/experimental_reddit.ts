
'use server';

import axios from 'axios';

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
  // Using a common location; adjust if more specific geo-targeting is needed from Scrapingdog
  const url = `https://api.scrapingdog.com/google?api_key=${SCRAPINGDOG_API_KEY}&q=${encodeURIComponent(query)}&location=United+States`;

  console.log(`[Experimental Reddit] Fetching Google search results from Scrapingdog for query: "${query}"`);

  try {
    const { data } = await axios.get<ScrapingdogGoogleResponse>(url);
    if (!data.organic_results || data.organic_results.length === 0) {
      console.warn("[Experimental Reddit] No organic results found by Scrapingdog for:", query);
      return [];
    }
    // Results from Scrapingdog are typically ordered by relevance already for Google Search
    return data.organic_results;
  } catch (err: any) {
    console.error("[Experimental Reddit] Scrapingdog API error during Google search:", err.response?.data || err.message);
    if (err.response?.data) {
        console.error("Scrapingdog error details:", JSON.stringify(err.response.data, null, 2));
    }
    return []; 
  }
}

/**
 * Searches Google via Scrapingdog for Reddit results and summarizes the snippets
 * of the top N results. This version does NOT scrape the content of the linked Reddit pages.
 * @param userQuestion The user's original query.
 * @param resultLimit The number of top Google search result snippets to summarize.
 * @returns A string summary of the snippets or an error/no results message.
 */
export async function searchRedditViaGoogleAndSummarizeSnippets(userQuestion: string, resultLimit: number = 3): Promise<string> {
  try {
    const googleResults = await fetchGoogleSearchResults(userQuestion);

    if (googleResults.length === 0) {
      return "No relevant Reddit discussions found via Google search for your query.";
    }

    const topResults = googleResults.slice(0, resultLimit);

    if (topResults.length === 0) {
      // This case should ideally not be hit if googleResults.length > 0, but as a safeguard:
      return "Found Google results, but could not extract top Reddit snippets.";
    }
    
    let summary = `Here's what a quick Google search for Reddit discussions found (top ${topResults.length} snippets):\n`;
    topResults.forEach((result, index) => {
      summary += `\n${index + 1}. Title: ${result.title}\n`;
      summary += `   Snippet: ${result.snippet}\n`;
      // summary += `   Link: ${result.link}\n`; // Link can be noisy for AI context, optional
    });

    return summary.trim();

  } catch (error: any) {
    console.error("[Experimental Reddit] Error in searchRedditViaGoogleAndSummarizeSnippets:", error.message);
    return "Sorry, I encountered an error trying to fetch experimental Reddit context.";
  }
}
