import {genkit} from 'genkit';

// Configure Genkit.
// Since @genkit-ai/openai cannot be installed, we remove it from plugins.
// Genkit might fall back to using environment variables like OPENAI_API_KEY
// if a flow requests an 'openai/...' model.
export const ai = genkit({
  plugins: [],
  logLevel: 'debug', // Enable debug logging
  // Model will be specified per-request in the AI flows (e.g., 'gpt-4o-mini')
  // Ensure OPENAI_API_KEY is set in your .env file and OPENAI_API_BASE_URL is NOT set.
});
