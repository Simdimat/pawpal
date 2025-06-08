
// src/lib/emergency-data-loader.ts
import fs from 'node:fs/promises';
import path from 'node:path';

interface EmergencyStep {
  title: string;
  details: string;
  important?: boolean;
}

interface EmergencyFlow {
  id: string;
  name: string;
  icon?: string;
  description: string;
  steps: EmergencyStep[];
  immediateActions?: string[];
  relevantContacts?: { name: string; number?: string; website?: string }[];
}

// Cached data
let emergencyFlowsCache: EmergencyFlow[] | null = null;

export async function retrieveEmergencyFlowData(): Promise<EmergencyFlow[]> {
  if (emergencyFlowsCache) {
    return emergencyFlowsCache;
  }

  try {
    // For server-side components/API routes in Next.js, path.join with process.cwd()
    // typically points to the project root.
    const filePath = path.join(process.cwd(), 'public', 'assets', 'data', 'emergency_flows.json');
    const jsonData = await fs.readFile(filePath, 'utf-8');
    const data: EmergencyFlow[] = JSON.parse(jsonData);
    emergencyFlowsCache = data;
    return data;
  } catch (error) {
    console.error('Failed to load or parse emergency_flows.json:', error);
    // Depending on how critical this data is, you might throw the error
    // or return an empty array / default structure.
    // For now, returning empty array to prevent full crash if file is missing during dev.
    return [];
  }
}
