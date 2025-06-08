
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import {config} from 'dotenv';

config(); // Ensure environment variables are loaded

// Configure Genkit with Google AI plugin
// This was its state after the ERESOLVE fix and before the "Genkit Foundation for Chatbot" step.
// It allows Genkit to be used for other features with Google AI, while the main chat uses OpenAI Assistant.
export const ai = genkit({
  plugins: [
    googleAI({
      // apiKey: process.env.GOOGLE_API_KEY, // API key is usually picked up from GOOGLE_API_KEY env var automatically
    }),
  ],
  logLevel: 'debug', 
  enableTracingAndMetrics: true, 
});
