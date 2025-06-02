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

const AskPawPalInputSchema = z.object({
  question: z.string().describe('The pet-related question to answer.'),
  yelpContext: z.string().optional().describe('Context from Yelp.'),
  redditContext: z.string().optional().describe('Context from Reddit.'),
  petfinderContext: z.string().optional().describe('Context from Petfinder.'),
});
export type AskPawPalInput = z.infer<typeof AskPawPalInputSchema>;

const AskPawPalOutputSchema = z.object({
  answer: z.string().describe('The answer to the pet-related question.'),
});
export type AskPawPalOutput = z.infer<typeof AskPawPalOutputSchema>;

export async function askPawPal(input: AskPawPalInput): Promise<AskPawPalOutput> {
  return askPawPalFlow(input);
}

const askPawPalPrompt = ai.definePrompt({
  name: 'askPawPalPrompt',
  input: {schema: AskPawPalInputSchema},
  output: {schema: AskPawPalOutputSchema},
  prompt: `You are PawPal SD, a friendly and knowledgeable AI assistant for pet owners in San Diego. Provide concise, helpful, and locally relevant information to answer the user's question.

Question: {{{question}}}

{{#if yelpContext}}
Yelp Context: {{{yelpContext}}}
{{/if}}

{{#if redditContext}}
Reddit Context: {{{redditContext}}}
{{/if}}

{{#if petfinderContext}}
Petfinder Context: {{{petfinderContext}}}
{{/if}}
`,
});

const askPawPalFlow = ai.defineFlow(
  {
    name: 'askPawPalFlow',
    inputSchema: AskPawPalInputSchema,
    outputSchema: AskPawPalOutputSchema,
  },
  async input => {
    const {output} = await askPawPalPrompt(input);
    return output!;
  }
);
