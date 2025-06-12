
import { NextResponse, type NextRequest } from 'next/server';
import { searchYelp, type YelpBusiness } from '@/services/yelp';

// Function to extract a search term and location from the query
// Tries to find common San Diego neighborhoods or zip codes.
function extractSearchParameters(query: string): { term: string; location: string; isAdoptionQuery: boolean } {
  const qLower = query.toLowerCase();
  let location = 'San Diego, CA'; // Default location
  let term = query; // Default term is the whole query
  let isAdoptionQuery = false;

  const adoptionKeywords = ["adopt", "adoption center", "shelter", "rescue"];
  if (adoptionKeywords.some(kw => qLower.includes(kw))) {
    isAdoptionQuery = true;
    // For adoption, the term can be more general like "animal shelter" or just the type of animal
    if (qLower.includes("dog")) term = "dog adoption";
    else if (qLower.includes("cat")) term = "cat adoption";
    else term = "animal shelter"; // Generic adoption term for Yelp
  }

  const nearMatch = qLower.match(/near\s+([\w\s\d,-]+)/);
  const inMatch = qLower.match(/in\s+([\w\s\d,-]+)/);
  const aroundMatch = qLower.match(/around\s+([\w\s\d,-]+)/);

  let extractedLocationPart: string | null = null;

  if (nearMatch?.[1]) {
    extractedLocationPart = nearMatch[1].trim();
  } else if (inMatch?.[1]) {
    extractedLocationPart = inMatch[1].trim();
  } else if (aroundMatch?.[1]) {
    extractedLocationPart = aroundMatch[1].trim();
  }

  const zipCodeMatch = qLower.match(/\b\d{5}\b/);
  if (zipCodeMatch?.[0]) {
    extractedLocationPart = zipCodeMatch[0]; // Prioritize zip code if found
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
    'Chula Vista, CA': ['chula vista'],
    'National City, CA': ['national city'],
    'El Cajon, CA': ['el cajon'],
    'La Mesa, CA': ['la mesa'],
    'Santee, CA': ['santee'],
    'Tijuana, BC, Mexico': ['tijuana', 'tj'],
  };

  for (const [fullLocation, keywords] of Object.entries(neighborhoods)) {
    if (keywords.some(kw => qLower.includes(kw))) {
      extractedLocationPart = fullLocation; // Prioritize detected neighborhood
      break;
    }
  }
  
  if (extractedLocationPart) {
    location = extractedLocationPart;
    // Attempt to refine the search term by removing the location part if it's not an adoption query
    // For adoption queries, the term is already set.
    if (!isAdoptionQuery) {
        const locationKeywords = extractedLocationPart.toLowerCase().split(/[\s,]+/);
        let tempTerm = qLower;
        locationKeywords.forEach(lk => {
            tempTerm = tempTerm.replace(new RegExp(`\\b${lk}\\b`, 'gi'), '');
        });
        tempTerm = tempTerm.replace(/near|in|around/gi, '').replace(/\s\s+/g, ' ').trim();
        if (tempTerm.length > 3) { 
            term = tempTerm;
        }
    }
  }
  
  // Refine non-adoption query terms further
  if (!isAdoptionQuery) {
    if (qLower.includes("vet")) term = "veterinarians";
    else if (qLower.includes("groomer")) term = "pet groomers";
    else if (qLower.includes("restaurant")) term = "pet friendly restaurants";
    else if (qLower.includes("park") || qLower.includes("beach")) term = "dog parks dog beaches";
    // Keep term as derived if not matching specific service keywords
  }


  console.log(`[API /yelp-context] Extracted for Yelp - Term: "${term}", Location: "${location}", isAdoptionQuery: ${isAdoptionQuery} from Original Query: "${query}"`);
  return { term, location, isAdoptionQuery };
}


function summarizeYelpResults(businesses: YelpBusiness[], queryTermUsed: string, locationUsed: string): string {
  if (!businesses || businesses.length === 0) {
    return `No relevant Yelp listings found for "${queryTermUsed}" in "${locationUsed}".`;
  }

  let summary = `Based on Yelp reviews for "${queryTermUsed}" in "${locationUsed}":\n`;
  const limit = Math.min(businesses.length, 3); 

  for (let i = 0; i < limit; i++) {
    const biz = businesses[i];
    summary += `- ${biz.name || 'Unnamed Business'}: ${biz.rating} stars (${biz.review_count} reviews).`;
    if (biz.categories && biz.categories.length > 0) {
        summary += ` Categories: ${biz.categories.map(c => c.title).join(', ')}.`;
    }
    if (biz.location?.display_address?.join(', ')) {
        summary += ` Location: ${biz.location.display_address.join(', ')}.`;
    }
    if (biz.url) {
        summary += ` More info: ${biz.url}`;
    }
    summary += "\n";
  }
  return summary.trim();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const originalQuery = searchParams.get('query');

    if (!originalQuery) {
      return NextResponse.json({ error: 'Query parameter is required for Yelp context.' }, { status: 400 });
    }

    const { term, location, isAdoptionQuery } = extractSearchParameters(originalQuery);
    
    let yelpCategories = "petservices,petstores,dogwalkers,pet_sitting,pet_grooming,veterinarians,dogparks,petfriendly"; // Default broad categories
    
    if (isAdoptionQuery) {
        yelpCategories = "animalshelters,nonprofit"; // More specific categories for adoption
        console.log(`[API /yelp-context] Adoption query detected. Using Yelp categories: "${yelpCategories}"`);
    } else {
        console.log(`[API /yelp-context] Non-adoption query. Using Yelp categories: "${yelpCategories}"`);
    }
    
    console.log(`[API /yelp-context] Fetching Yelp businesses. Term: "${term}", Location: "${location}", Categories: "${yelpCategories}"`);

    const businesses = await searchYelp(term, location, yelpCategories, 5); 

    if (!businesses || businesses.length === 0) {
      console.log(`[API /yelp-context] No businesses found by Yelp for term: "${term}", location: "${location}", categories: "${yelpCategories}".`);
      return NextResponse.json({ context: `No relevant Yelp listings found for "${term}" in "${location}".`, source: 'none' });
    }
    
    const contextSummary = summarizeYelpResults(businesses, term, location);
    console.log(`[API /yelp-context] Summarized Yelp context for query "${originalQuery}" (Term: "${term}", Location: "${location}"): ${contextSummary.substring(0,100)}...`);

    return NextResponse.json({ context: contextSummary, source: 'yelp' });

  } catch (error: any) {
    console.error('[API /yelp-context] Error:', error);
    return NextResponse.json({ context: `Error fetching Yelp context: ${error.message || 'Unknown error'}.`, source: 'none' }, { status: 500 });
  }
}
    
