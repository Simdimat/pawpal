import {genkit} from 'genkit';

// Configure Genkit.
// No plugins are specified here.
// Genkit will attempt to use environment variables like OPENAI_API_KEY
// for models like 'openai/gpt-4o-mini' if no specific plugin claims them.
export const ai = genkit({
  plugins: [],
  logLevel: 'debug', // Enable debug logging
});
