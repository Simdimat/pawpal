
// src/ai/flows/ask-pawpal.ts
'use server';

/**
 * @fileOverview A Genkit flow for answering pet-related questions specific to San Diego, incorporating context from Yelp, Reddit, and Petfinder.
 *
 * - askPawPal - A function that handles the question answering process.
 * - AskPawPalInput - The input type for the askPawPal function.
 * - AskPawPalOutput - The return type for the askPawPal function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { searchReddit, type RedditPost } from '@/services/reddit';

const AskPawPalInputSchema = z.object({
  question: z.string().describe('The pet-related question to answer.'),
  yelpContext: z.string().optional().describe('Context from Yelp.'),
  redditContext: z.string().optional().describe('Context from Reddit (DEPRECATED - use searchRedditTool).'),
  petfinderContext: z.string().optional().describe('Context from Petfinder.'),
});
export type AskPawPalInput = z.infer<typeof AskPawPalInputSchema>;

const AskPawPalOutputSchema = z.object({
  answer: z.string().describe('The answer to the pet-related question.'),
});
export type AskPawPalOutput = z.infer<typeof AskPawPalOutputSchema>;

const searchRedditTool = ai.defineTool(
  {
    name: 'searchRedditTool',
    description: 'Searches Reddit for community advice, experiences, and local discussions relevant to a pet-related question in San Diego. Use for topics like specific vet experiences (especially in Tijuana), local pet issues (e.g., skunk encounters, coyote warnings), or urgent situations where up-to-date community advice might be valuable. Focus on questions that benefit from recent, local, or anecdotal information.',
    inputSchema: z.object({ 
      query: z.string().describe('A concise search query derived from the user\'s question, tailored for Reddit. Include "San Diego" or "Tijuana" for location-specific queries if relevant.') 
    }),
    outputSchema: z.object({ 
      searchResultsSummary: z.string().describe('A summary of the top 3-5 relevant Reddit posts, including titles and brief snippets or key advice points. If no relevant results, state that clearly.') 
    }),
  },
  async (input) => {
    try {
      const posts: RedditPost[] = await searchReddit(input.query);
      if (!posts || posts.length === 0) {
        return { searchResultsSummary: 'No relevant Reddit discussions found for this query.' };
      }
      const summary = posts
        .slice(0, 5) // Take top 5
        .map(post => `Title: ${post.title}\nSnippet: ${post.selftext ? post.selftext.substring(0, 150) + '...' : 'No additional text.'}\nURL: https://reddit.com${post.permalink}`)
        .join('\n\n---\n\n');
      return { searchResultsSummary: summary };
    } catch (error) {
      console.error('Error in searchRedditTool:', error);
      return { searchResultsSummary: 'Could not retrieve information from Reddit at this time.' };
    }
  }
);

export async function askPawPal(input: AskPawPalInput): Promise<AskPawPalOutput> {
  return askPawPalFlow(input);
}

const askPawPalPrompt = ai.definePrompt({
  name: 'askPawPalPrompt',
  model: 'gpt-3.5-turbo', 
  input: {schema: AskPawPalInputSchema},
  output: {schema: AskPawPalOutputSchema},
  tools: [searchRedditTool], 
  prompt: `You are PawPal SD, a friendly and knowledgeable AI assistant for pet owners in San Diego. Provide concise, helpful, and locally relevant information to answer the user's question.

Question: {{{question}}}

{{#if yelpContext}}
Yelp Context:
{{{yelpContext}}}
{{/if}}

{{#if petfinderContext}}
Petfinder Context:
{{{petfinderContext}}}
{{/if}}

If the user's question involves specific local issues (like skunk encounters, coyote warnings), experiences with veterinarians (especially in Tijuana), or seeks community advice for pet-related problems in the San Diego area, consider using the 'searchRedditTool' to gather recent discussions and insights. Extract a focused query for the tool from the user's question.

{{#if tool_outputs.searchRedditTool}}
Recent Reddit Community Insights:
{{{tool_outputs.searchRedditTool.searchResultsSummary}}}
{{/if}}

Based on all available information, including any Yelp, Petfinder, or Reddit context, provide a comprehensive answer to the user's question. If Reddit information was fetched and is relevant, incorporate it into your answer.
`,
});

const askPawPalFlow = ai.defineFlow(
  {
    name: 'askPawPalFlow',
    inputSchema: AskPawPalInputSchema,
    outputSchema: AskPawPalOutputSchema,
  },
  async (input) => {
    const { question, yelpContext, petfinderContext } = input;
    const flowInput = { question, yelpContext, petfinderContext };

    const {output} = await askPawPalPrompt(flowInput);
    return output!;
  }
);
