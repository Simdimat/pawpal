
import { NextResponse, type NextRequest } from 'next/server';
import { searchYelp, type YelpBusiness } from '@/services/yelp';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get('term');
  const location = searchParams.get('location');
  const categories = searchParams.get('categories'); // Optional, comma-separated
  const limit = searchParams.get('limit');

  if (!term || !location) {
    return NextResponse.json({ error: 'Search term and location are required' }, { status: 400 });
  }

  try {
    const businesses: YelpBusiness[] = await searchYelp(
      term,
      location,
      categories || undefined,
      limit ? parseInt(limit, 10) : 20
    );
    return NextResponse.json(businesses);
  } catch (error) {
    console.error('API Yelp Search Route Error:', error);
    return NextResponse.json({ error: 'Failed to fetch data from Yelp' }, { status: 500 });
  }
}
