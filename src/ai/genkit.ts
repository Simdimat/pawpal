import {genkit} from 'genkit';

// Configure Genkit without specific plugins, relying on environment variables
// for OpenAI-compatible APIs like Grok.
export const ai = genkit({
  plugins: [], // No default plugins
  // Model will be specified per-request in the AI flows (e.g., 'grok-2-1212')
});
