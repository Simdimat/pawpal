
import { NextResponse, type NextRequest } from 'next/server';
import { fetchOrganizations, type PetfinderOrganization } from '@/services/petfinder';

// Updated function to extract location, prioritizing specific San Diego areas
function extractLocationFromQuery(query: string): string {
  const qLower = query.toLowerCase();
  
  // Priority for zip codes
  const zipCodeMatch = qLower.match(/\b\d{5}\b/);
  if (zipCodeMatch?.[0]) {
    console.log(`[API /petfinder-context] Extracted zip code: ${zipCodeMatch[0]} from query: "${query}"`);
    return zipCodeMatch[0];
  }

  const neighborhoods: Record<string, string[]> = {
    'Clairemont, San Diego, CA': ['clairemont'],
    'La Jolla, San Diego, CA': ['la jolla', 'lajolla'],
    'North Park, San Diego, CA': ['north park'],
    'Downtown San Diego, CA': ['downtown', 'gaslamp'],
    'Pacific Beach, San Diego, CA': ['pacific beach', 'pb'],
    'Ocean Beach, San Diego, CA': ['ocean beach', 'ob'],
    'Hillcrest, San Diego, CA': ['hillcrest'],
    'Point Loma, San Diego, CA': ['point loma'],
    'Carmel Valley, San Diego, CA': ['carmel valley'],
    'Miramar, San Diego, CA': ['miramar'],
    'Mira Mesa, San Diego, CA': ['mira mesa'],
    'University City, San Diego, CA': ['university city', 'utc'],
    // Broader areas (less specific but better than just "San Diego, CA" if matched)
    'Chula Vista, CA': ['chula vista'],
    'National City, CA': ['national city'],
    'El Cajon, CA': ['el cajon'],
    'La Mesa, CA': ['la mesa'],
    'Santee, CA': ['santee'],
    'Tijuana, BC, Mexico': ['tijuana', 'tj'],
    // Default if no specific part is found
    'San Diego, CA': ['san diego', 'sd'], 
  };

  for (const [fullLocation, keywords] of Object.entries(neighborhoods)) {
    if (keywords.some(kw => qLower.includes(kw))) {
      console.log(`[API /petfinder-context] Extracted location: "${fullLocation}" from query: "${query}" for Petfinder.`);
      return fullLocation;
    }
  }
  
  // Fallback if absolutely no match
  const defaultLocation = 'San Diego, CA';
  console.log(`[API /petfinder-context] No specific location extracted from query: "${query}". Defaulting to "${defaultLocation}" for Petfinder.`);
  return defaultLocation;
}

function summarizePetfinderResults(organizations: PetfinderOrganization[], query: string, location: string): string {
  if (!organizations || organizations.length === 0) {
    return `No relevant Petfinder shelter or rescue listings found for organizations in "${location}" related to your query "${query}".`;
  }

  let summary = `According to Petfinder, here are some relevant organizations in/near "${location}":\n`;
  const limit = Math.min(organizations.length, 3); 

  for (let i = 0; i < limit; i++) {
    const org = organizations[i];
    summary += `- ${org.name || 'Unnamed Organization'}`;
    if (org.address?.city && org.address?.state) {
      summary += ` in ${org.address.city}, ${org.address.state}`;
    }
    summary += ".";
    if (org.mission_statement) {
      summary += ` Mission: ${org.mission_statement.substring(0, 75).trim()}${org.mission_statement.length > 75 ? '...' : ''}`;
    } else {
      summary += " They are dedicated to animal welfare.";
    }
    if (org.website || org.url) {
        summary += ` More info: ${org.website || org.url}`;
    }
    summary += "\n";
  }
  return summary.trim();
}


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required for Petfinder context.' }, { status: 400 });
    }

    const locationForPetfinder = extractLocationFromQuery(query);
    
    console.log(`[API /petfinder-context] Fetching Petfinder organizations for effective location: "${locationForPetfinder}" based on original query: "${query}"`);

    const organizations = await fetchOrganizations(locationForPetfinder, 10); 

    if (!organizations || organizations.length === 0) {
      console.log(`[API /petfinder-context] No organizations found by Petfinder for effective location: "${locationForPetfinder}".`);
      return NextResponse.json({ context: `No Petfinder organizations found for "${locationForPetfinder}" related to your query.`, source: 'none' });
    }
    
    const contextSummary = summarizePetfinderResults(organizations, query, locationForPetfinder);
    console.log(`[API /petfinder-context] Summarized Petfinder context for query "${query}" (location: "${locationForPetfinder}"): ${contextSummary.substring(0,100)}...`);

    return NextResponse.json({ context: contextSummary, source: 'petfinder' });

  } catch (error: any) {
    console.error('[API /petfinder-context] Error:', error);
    return NextResponse.json({ context: `Error fetching Petfinder context: ${error.message || 'Unknown error'}.`, source: 'none' }, { status: 500 });
  }
}

    