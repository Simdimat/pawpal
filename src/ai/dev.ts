
import { config } from 'dotenv';
config();

import '@/ai/flows/emergency-flow-context.ts';
import '@/ai/flows/ask-pawpal.ts';
import '@/ai/flows/fetch-reddit-context-via-web-search-simulation.ts'; // Added new flow
