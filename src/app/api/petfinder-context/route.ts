
import { NextResponse, type NextRequest } from 'next/server';
import { fetchOrganizations, type PetfinderOrganization } from '@/services/petfinder';

// Helper function to extract a simple location from the query, defaulting to San Diego
// This is very basic and might need improvement for more complex queries.
function extractLocationFromQuery(query: string): string {
  const sanDiegoVariants = ['san diego', 'sd'];
  const tijuanaVariants = ['tijuana', 'tj'];

  const qLower = query.toLowerCase();

  if (tijuanaVariants.some(variant => qLower.includes(variant))) {
    return 'Tijuana, BC, Mexico';
  }
  // Default to San Diego if no other specific location is mentioned or if SD is mentioned
  if (sanDiegoVariants.some(variant => qLower.includes(variant)) || !tijuanaVariants.some(variant => qLower.includes(variant))) {
    return 'San Diego, CA';
  }
  return 'San Diego, CA'; // Fallback default
}

function summarizePetfinderResults(organizations: PetfinderOrganization[], query: string): string {
  if (!organizations || organizations.length === 0) {
    return `No relevant Petfinder shelter or rescue listings found matching your query "${query}".`;
  }

  let summary = "According to Petfinder, here are some relevant organizations:\n";
  const limit = Math.min(organizations.length, 3); // Show up to 3

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

    const location = extractLocationFromQuery(query);
    // For Petfinder, the 'query' itself isn't used to filter organizations by name directly in fetchOrganizations.
    // fetchOrganizations primarily uses location. We can list general orgs or filter later if Petfinder API allows.
    // For now, we'll fetch organizations for the location and the LLM can use the user's query to pick relevant info.
    
    console.log(`[API /petfinder-context] Fetching organizations for location: "${location}" based on query: "${query}"`);

    const organizations = await fetchOrganizations(location, 10); // Fetch up to 10, summarize fewer

    if (!organizations || organizations.length === 0) {
      console.log(`[API /petfinder-context] No organizations found by Petfinder for location: "${location}".`);
      return NextResponse.json({ context: `No Petfinder organizations found for "${location}" related to your query.`, source: 'none' });
    }
    
    const contextSummary = summarizePetfinderResults(organizations, query);
    console.log(`[API /petfinder-context] Summarized Petfinder context for query "${query}": ${contextSummary.substring(0,100)}...`);

    return NextResponse.json({ context: contextSummary, source: 'petfinder' });

  } catch (error: any) {
    console.error('[API /petfinder-context] Error:', error);
    return NextResponse.json({ context: `Error fetching Petfinder context: ${error.message || 'Unknown error'}.`, source: 'none' }, { status: 500 });
  }
}
