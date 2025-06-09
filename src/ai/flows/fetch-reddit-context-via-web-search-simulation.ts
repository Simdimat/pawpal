
'use server';
/**
 * @fileOverview A Genkit flow to simulate fetching Reddit context via a web search.
 *
 * - fetchRedditContextViaWebSearchSimulation - Main function to handle user questions.
 * - FetchRedditContextInputSchema - Input type for the flow.
 * - FetchRedditContextOutputSchema - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const FetchRedditContextInputSchema = z.object({
  userQuery: z.string().describe("The user's original query for which Reddit context is needed."),
});
export type FetchRedditContextInput = z.infer<typeof FetchRedditContextInputSchema>;

export const FetchRedditContextOutputSchema = z.object({
  summary: z.string().describe('A summary of likely Reddit discussions based on a simulated web search.'),
  source: z.string().describe('Indicates the source of the context, e.g., "simulated_reddit_search".'),
});
export type FetchRedditContextOutput = z.infer<typeof FetchRedditContextOutputSchema>;

const simulatedRedditSearchPrompt = ai.definePrompt({
  name: 'simulatedRedditSearchPrompt',
  input: {schema: FetchRedditContextInputSchema},
  output: {schema: z.object({ redditSummary: z.string() }) }, // LLM should output a string for the summary
  prompt: `You are an AI assistant skilled at understanding what kind of discussions typically appear on Reddit.
The user's query is: "{{userQuery}}"

Imagine you have performed a web search for: "{{userQuery}} site:reddit.com".

Based on your knowledge of Reddit content and common discussions related to the user's query:
1. Identify 2-3 distinct, highly relevant discussion topics, themes, or specific advice that would likely appear in the top Reddit search results for this query.
2. For each, provide a very concise summary (1-2 sentences is ideal per point).
3. Consolidate these points into a brief, helpful text summary.
4. Start your entire response with "Based on common Reddit discussions for this topic:"
5. If the query is very niche or unlikely to have much Reddit discussion, you can state "It's difficult to pinpoint specific common Reddit discussions for such a niche query, but general advice might include..." and then offer very generic points if possible, or simply state that relevant common discussions are not readily identifiable.

Focus on what would be genuinely helpful and representative of Reddit discussions.
Provide only the consolidated summary as a single string under the 'redditSummary' field.
`,
});

const fetchRedditContextFlow = ai.defineFlow(
  {
    name: 'fetchRedditContextViaWebSearchSimulationFlow',
    inputSchema: FetchRedditContextInputSchema,
    outputSchema: FetchRedditContextOutputSchema,
  },
  async (input: FetchRedditContextInput): Promise<FetchRedditContextOutput> => {
    console.log('[Genkit Flow - Web Search Sim] Initiated for query:', input.userQuery);
    try {
      console.log('[Genkit Flow - Web Search Sim] Calling simulatedRedditSearchPrompt with input:', JSON.stringify(input));
      const {output} = await simulatedRedditSearchPrompt(input);
      
      console.log('[Genkit Flow - Web Search Sim] Raw output from LLM prompt:', JSON.stringify(output));

      if (output?.redditSummary) {
        console.log('[Genkit Flow - Web Search Sim] Successfully generated summary:', output.redditSummary);
        return {
          summary: output.redditSummary,
          source: 'simulated_reddit_search',
        };
      } else {
        console.warn('[Genkit Flow - Web Search Sim] LLM did not return a summary in the expected format (output.redditSummary is missing or falsy). Full output:', JSON.stringify(output));
        return {
          summary: 'Simulated Reddit: LLM did not return summary in expected format.',
          source: 'simulated_reddit_search_failed_format',
        };
      }
    } catch (error: any) {
      console.error('[Genkit Flow - Web Search Sim] Error during flow execution:', error.message, error.stack);
      return {
        summary: `Simulated Reddit: Error during Genkit flow - ${error.message.substring(0, 100)}`,
        source: 'simulated_reddit_search_error_execution',
      };
    }
  }
);

export async function fetchRedditContextViaWebSearchSimulation(
  input: FetchRedditContextInput
): Promise<FetchRedditContextOutput> {
  return fetchRedditContextFlow(input);
}

