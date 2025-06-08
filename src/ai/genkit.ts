import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Configure Genkit with Google AI plugin
export const ai = genkit({
  plugins: [googleAI()],
  logLevel: 'debug', // Keep debug logging
});
