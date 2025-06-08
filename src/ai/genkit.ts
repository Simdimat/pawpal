import {genkit} from 'genkit';
// Removed: import {openai} from '@genkit-ai/openai';

// Configure Genkit.
// Since @genkit-ai/openai cannot be installed, we remove it from plugins.
// Genkit might fall back to using environment variables like OPENAI_API_KEY
// if a flow requests an 'openai/...' model.
export const ai = genkit({
  plugins: [], // No explicit OpenAI plugin due to installation issues
  // Model will be specified per-request in the AI flows (e.g., 'openai/gpt-4o-mini')
  // Ensure OPENAI_API_KEY is set in your .env file.
});
