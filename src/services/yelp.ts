
import axios from 'axios';
import { mockYelpVets, mockYelpParks, mockYelpBeaches, mockYelpRestaurants } from '@/lib/mock-data';

const YELP_API_URL = 'https://api.yelp.com/v3/businesses/search';
const API_KEY = process.env.YELP_API_KEY;

export interface YelpBusiness {
  id: string;
  alias: string;
  name: string;
  image_url: string;
  is_closed: boolean;
  url: string;
  review_count: number;
  categories: { alias: string; title: string }[];
  rating: number;
  coordinates: { latitude: number; longitude: number };
  transactions: string[];
  price?: string;
  location: {
    address1: string | null;
    address2: string | null;
    address3: string | null;
    city: string;
    zip_code: string;
    country: string;
    state: string;
    display_address: string[];
  };
  phone: string;
  display_phone: string;
  distance?: number;
}

interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total: number;
  region: {
    center: { longitude: number; latitude: number };
  };
}

export async function searchYelp(term: string, location: string, categories?: string, limit: number = 20): Promise<YelpBusiness[]> {
  if (!API_KEY || API_KEY.startsWith('YOUR_')) {
    console.warn(`Yelp API key not configured or is a placeholder. Returning mock data for term: "${term}" and categories: "${categories}".`);
    if (categories?.includes('veterinarians')) return mockYelpVets.slice(0, limit);
    if (categories?.includes('dogparks')) return mockYelpParks.slice(0, limit);
    if (categories?.includes('beaches')) return mockYelpBeaches.slice(0, limit);
    if (categories?.includes('restaurants')) return mockYelpRestaurants.slice(0, limit);
    console.warn("No mock data match for categories:", categories);
    return [];
  }

  try {
    const response = await axios.get<YelpSearchResponse>(YELP_API_URL, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      params: {
        term,
        location,
        categories: categories || undefined, // e.g., 'veterinarians,petservices' or 'dogparks,beaches'
        limit,
        sort_by: 'best_match',
      },
    });
    return response.data.businesses;
  } catch (error) {
    console.error(`Error fetching data from Yelp for term "${term}" in "${location}":`, error);
    throw new Error('Failed to fetch data from Yelp.');
  }
}

// Example function for chat context
export async function getYelpContextForChat(topic: string, location: string = 'San Diego, CA'): Promise<string> {
  let context = "";
  try {
    if (topic.includes("vet")) {
      const vets = await searchYelp("veterinarian", location, "veterinarians", 3);
      if (vets.length > 0) {
        context += `\nTop Yelp Vets in ${location}:\n`;
        vets.forEach(vet => {
          context += `- ${vet.name} (${vet.rating} stars, ${vet.review_count} reviews). Phone: ${vet.display_phone}\n`;
        });
      }
    }
    if (topic.includes("park") || topic.includes("beach")) {
      const places = await searchYelp("dog park or dog beach", location, "dogparks,beaches", 3);
       if (places.length > 0) {
        context += `\nTop Yelp Dog Parks/Beaches in ${location}:\n`;
        places.forEach(place => {
          context += `- ${place.name} (${place.rating} stars). Location: ${place.location.address1 || place.location.city}\n`;
        });
      }
    }
    if (topic.includes("restaurant")) {
       const restaurants = await searchYelp("pet friendly restaurant", location, "restaurants,petfriendly", 3);
       if (restaurants.length > 0) {
        context += `\nTop Yelp Pet-Friendly Restaurants in ${location}:\n`;
        restaurants.forEach(r => {
          context += `- ${r.name} (${r.rating} stars). Address: ${r.location.address1 || r.location.city}\n`;
        });
      }
    }
    return context.trim();
  } catch (error) {
    console.error('Error fetching Yelp context for chat:', error);
    return "Could not retrieve Yelp information for chat.";
  }
}
