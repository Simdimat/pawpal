
import { NextResponse, type NextRequest } from 'next/server';
import { fetchOrganizations, type PetfinderOrganization } from '@/services/petfinder';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location') || 'San Diego, CA'; // Default to San Diego
  const limit = searchParams.get('limit');

  try {
    const organizations: PetfinderOrganization[] = await fetchOrganizations(
      location,
      limit ? parseInt(limit, 10) : 20
    );
    return NextResponse.json(organizations);
  } catch (error) {
    console.error('API Petfinder Organizations Route Error:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations from Petfinder' }, { status: 500 });
  }
}
