
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';

config(); // Ensure environment variables are loaded

// Configure Genkit with Google AI plugin
export const ai = genkit({
  plugins: [
    googleAI({
      // apiKey: process.env.GOOGLE_API_KEY, // API key is usually picked up from GOOGLE_API_KEY env var automatically
    }),
  ],
  logLevel: 'debug', // Or use GENKIT_LOG_LEVEL from .env
  enableTracingAndMetrics: true, // Optional: enable tracing for better debugging
});
