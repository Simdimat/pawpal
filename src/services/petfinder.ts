
import axios from 'axios';

const PETFINDER_API_URL = 'https://api.petfinder.com/v2';
const API_KEY = process.env.PETFINDER_API_KEY;
const API_SECRET = process.env.PETFINDER_API_SECRET;

interface PetfinderToken {
  token_type: string;
  expires_in: number;
  access_token: string;
}

let tokenCache: {
  accessToken: string | null;
  expiresAt: number | null;
} = {
  accessToken: null,
  expiresAt: null,
};

async function getAccessToken(): Promise<string> {
  if (tokenCache.accessToken && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  if (!API_KEY || !API_SECRET) {
    throw new Error('Petfinder API key or secret is not configured.');
  }

  try {
    const response = await axios.post<PetfinderToken>(
      `${PETFINDER_API_URL}/oauth2/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: API_KEY,
        client_secret: API_SECRET,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    const { access_token, expires_in } = response.data;
    tokenCache = {
      accessToken: access_token,
      expiresAt: Date.now() + (expires_in - 300) * 1000, // Refresh 5 mins before expiry
    };
    return access_token;
  } catch (error) {
    console.error('Error fetching Petfinder access token:', error);
    throw new Error('Failed to authenticate with Petfinder API.');
  }
}

export interface PetfinderOrganization {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: {
    address1: string | null;
    address2: string | null;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  hours: any; // Can be complex
  url: string;
  website: string | null;
  mission_statement: string | null;
  photos: { small: string; medium: string; large: string; full: string }[];
  distance?: number;
}

interface PetfinderOrganizationsResponse {
  organizations: PetfinderOrganization[];
  pagination: any;
}

export async function fetchOrganizations(location: string = 'San Diego, CA', limit: number = 20): Promise<PetfinderOrganization[]> {
  const accessToken = await getAccessToken();
  try {
    const response = await axios.get<PetfinderOrganizationsResponse>(`${PETFINDER_API_URL}/organizations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        location,
        limit,
        status: 'adoptable', // Typically we want active orgs
      },
    });
    return response.data.organizations;
  } catch (error) {
    console.error('Error fetching organizations from Petfinder:', error);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token might have expired, clear cache and retry once
      tokenCache.accessToken = null;
      tokenCache.expiresAt = null;
      console.log('Petfinder token expired or invalid, attempting refresh...');
      return fetchOrganizations(location, limit); // Recursive call, ensure it doesn't loop infinitely
    }
    throw new Error('Failed to fetch organizations from Petfinder.');
  }
}

// Example function for chat context - might fetch animals from specific orgs or general animals
export async function getPetfinderContextForChat(topic: string, location: string = 'San Diego, CA'): Promise<string> {
  const accessToken = await getAccessToken();
  let context = "";
  try {
    if (topic.includes("shelter") || topic.includes("volunteer")) {
      const orgs = await fetchOrganizations(location, 5);
      if (orgs.length > 0) {
        context += `\nNearby Petfinder Shelters in ${location}:\n`;
        orgs.forEach(org => {
          context += `- ${org.name} (${org.address?.city || ''}). Website: ${org.website || org.url}\n`;
        });
      }
    }
    // Could add fetching animals by type if needed, e.g. /animals?type=dog&location=...
    // For now, just orgs.
    return context.trim();
  } catch (error) {
    console.error('Error fetching Petfinder context for chat:', error);
    return "Could not retrieve Petfinder information for chat.";
  }
}
