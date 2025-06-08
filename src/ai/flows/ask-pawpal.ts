
'use server';
/**
 * @fileOverview A Genkit flow for PawPal SD, answering pet-related questions.
 *
 * - askPawPal - Main function to handle user questions.
 * - AskPawPalInput - Input type for the flow.
 * - AskPawPalOutput - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { retrieveEmergencyFlowData } from '@/lib/emergency-data-loader'; // Helper to load JSON

const AskPawPalInputSchema = z.object({
  question: z.string().describe('The user\'s question for PawPal SD.'),
  chatUserId: z.string().optional().describe('Unique ID for the user/chat session.'),
});
export type AskPawPalInput = z.infer<typeof AskPawPalInputSchema>;

const AskPawPalOutputSchema = z.object({
  answer: z.string().describe('PawPal SD\'s answer to the question.'),
  // For future UI enhancements:
  // scrollToSection: z.string().optional().describe('Optional ID of a page section to scroll to.'),
  // structuredData: z.any().optional().describe('Optional structured data for custom rendering.'),
});
export type AskPawPalOutput = z.infer<typeof AskPawPalOutputSchema>;

// Tool to get emergency information
const getEmergencyInfoTool = ai.defineTool(
  {
    name: 'getEmergencyInfoTool',
    description: 'Provides information and steps for specific pet emergencies. Use this if the user asks about what to do in an emergency like "my dog got sprayed by a skunk", "found a stray animal", "poisoning", "heatstroke", etc.',
    inputSchema: z.object({
      emergencyType: z.string().describe('The specific type of pet emergency (e.g., "skunk spray", "found stray cat", "chocolate ingestion"). Try to match keywords from the user query like "skunk", "stray", "poison".'),
    }),
    outputSchema: z.object({
      adviceSummary: z.string().describe('A brief summary of general or community advice for this emergency.'),
      staticSteps: z.array(z.object({title: z.string(), details: z.string(), important: z.boolean().optional()})).optional().describe('Specific, step-by-step instructions if available from static knowledge.'),
      relevantContacts: z.array(z.object({ name: z.string(), number: z.string().optional(), website: z.string().optional() })).optional().describe('Relevant contact information if available.'),
      immediateActions: z.array(z.string()).optional().describe('Critical immediate actions if available.'),
    }),
  },
  async (input) => {
    const emergencyFlows = await retrieveEmergencyFlowData();
    let advice = 'No specific community advice loaded for this tool yet.';
    let steps: any[] = [];
    let contacts: any[] = [];
    let immediate: any[] = [];

    if (input.emergencyType.toLowerCase().includes('skunk')) {
      const skunkFlow = emergencyFlows.find(f => f.id === 'skunk');
      if (skunkFlow) {
        steps = skunkFlow.steps;
        contacts = skunkFlow.relevantContacts || [];
        immediate = skunkFlow.immediateActions || [];
      }
      // Simulated Reddit/Community advice
      advice = 'Many pet owners and vets recommend a de-skunking solution made of hydrogen peroxide, baking soda, and dish soap. Always avoid the eyes. It\'s a good idea to have a skunk emergency kit prepared if you live in an area with skunks. Wash your pet outdoors if possible to prevent the smell from spreading inside your home.';
      return { adviceSummary: advice, staticSteps: steps, relevantContacts: contacts, immediateActions: immediate };
    }
    
    // Placeholder for other emergencies
    return { 
      adviceSummary: `For ${input.emergencyType}, it's always best to contact your veterinarian or an emergency pet hospital immediately. I can provide general first aid information if you specify the emergency.`,
      staticSteps: [],
      relevantContacts: [],
      immediateActions: [],
    };
  }
);

const askPawPalFlow = ai.defineFlow(
  {
    name: 'askPawPalFlow',
    inputSchema: AskPawPalInputSchema,
    outputSchema: AskPawPalOutputSchema,
    // Ensure tools are available to the flow
    tools: [getEmergencyInfoTool],
  },
  async (input) => {
    const model = 'googleai/gemini-1.5-flash-latest';
    
    const prompt = `You are PawPal SD, a friendly and expert AI assistant for pet owners in San Diego.
User's Question: "${input.question}"

Your primary goal is to provide helpful, concise, and actionable advice.

If the question is about a pet emergency (e.g., "skunk", "poison", "choking", "found stray"):
1. Use the 'getEmergencyInfoTool' to gather specific advice and steps.
2. Present the immediate actions first, if any.
3. Then, clearly list the step-by-step instructions provided by the tool.
4. Include the advice summary from the tool, perhaps framing it as "Community tips suggest..." or "General advice includes...".
5. List any relevant contacts provided by the tool.
6. ALWAYS add a disclaimer: "This information is for guidance only. Always consult a veterinarian for professional medical advice, especially in an emergency."

If the question is NOT an emergency I can currently handle with my tools:
- Provide a polite and helpful response. For now, you can say: "I'm PawPal SD, and I'm best at helping with common pet emergencies right now, like what to do if your dog gets sprayed by a skunk. For other questions, I recommend checking trusted veterinary websites or local San Diego pet resources. How can I help with an emergency today?"
- Do not attempt to answer complex questions outside of emergencies without using a specific tool for that topic (we will add more tools later).

Keep your answers clear, empathetic, and focused on the user's needs.
`;

    const llmResponse = await ai.generate({
      model: model,
      prompt: prompt,
      tools: [getEmergencyInfoTool], // Make tool available to this specific generation call
      output: {
        format: 'json', // Request JSON if you want to parse structured output, otherwise 'text'
        schema: AskPawPalOutputSchema, // Optional: guide the LLM to produce output matching this schema
      },
       // Optional: Add safety settings if needed, though defaults are usually fine for this type of content
       config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }, // Allow some general advice that might be "dangerous" if misinterpreted, but block high harm.
        ],
      },
    });

    // If output format is JSON and schema is provided, llmResponse.output should be structured
    const output = llmResponse.output();

    if (output) {
      return output;
    }

    // Fallback if structured output fails or if text format was used
    let answerText = llmResponse.text();
    
    // If tools were called, their output is available in llmResponse.toolRequests and llmResponse.toolResponses
    // The main prompt already instructs the LLM to synthesize this, so 'answerText' should ideally contain the synthesized result.
    // For more complex synthesis, you might need to manually combine llmResponse.text() with tool_outputs if the LLM doesn't do it well.

    return { answer: answerText || "I'm sorry, I couldn't generate a response for that. Please try rephrasing your question." };
  }
);

export async function askPawPal(input: AskPawPalInput): Promise<AskPawPalOutput> {
  return askPawPalFlow(input);
}
