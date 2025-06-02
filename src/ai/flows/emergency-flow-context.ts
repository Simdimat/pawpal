'use server';

/**
 * @fileOverview Augments static emergency flow advice with recent Reddit community insights.
 *
 * - getEmergencyContext - Retrieves supplementary context from Reddit for a given emergency type.
 * - GetEmergencyContextInput - The input type for the getEmergencyContext function.
 * - GetEmergencyContextOutput - The return type for the getEmergencyContext function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetEmergencyContextInputSchema = z.object({
  emergencyType: z
    .string()
    .describe('The type of emergency situation (e.g., skunk, found stray, rattlesnake).'),
});
export type GetEmergencyContextInput = z.infer<typeof GetEmergencyContextInputSchema>;

const GetEmergencyContextOutputSchema = z.object({
  redditAdvice: z
    .string()
    .describe('A summary of recent relevant advice from Reddit regarding the emergency.'),
});
export type GetEmergencyContextOutput = z.infer<typeof GetEmergencyContextOutputSchema>;

export async function getEmergencyContext(input: GetEmergencyContextInput): Promise<GetEmergencyContextOutput> {
  return emergencyFlowContextFlow(input);
}

const redditContextPrompt = ai.definePrompt({
  name: 'redditContextPrompt',
  input: {schema: GetEmergencyContextInputSchema},
  output: {schema: GetEmergencyContextOutputSchema},
  prompt: `You are an AI assistant providing supplementary advice for pet emergencies in San Diego.

  Summarize recent relevant advice from Reddit regarding the following emergency type:

  {{{emergencyType}}}

  Present the advice in a concise and helpful manner.

  Make sure it is actionable for the pet owner.
  `,
});

const emergencyFlowContextFlow = ai.defineFlow(
  {
    name: 'emergencyFlowContextFlow',
    inputSchema: GetEmergencyContextInputSchema,
    outputSchema: GetEmergencyContextOutputSchema,
  },
  async input => {
    const {output} = await redditContextPrompt(input);
    return output!;
  }
);
