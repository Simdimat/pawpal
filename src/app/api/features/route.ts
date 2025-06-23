
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const requests = await db.collection('feature_requests')
      .find({})
      .sort({ votes: -1 }) // Sort by most votes
      .toArray();
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching feature requests:', error);
    return NextResponse.json({ error: 'Failed to fetch feature requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suggestion } = body;

    if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid suggestion provided' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const newRequest = {
      text: suggestion.trim(),
      votes: 0,
      createdAt: new Date(),
    };

    const result = await db.collection('feature_requests').insertOne(newRequest);

    return NextResponse.json({ message: 'Suggestion added successfully', insertedId: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Error adding feature suggestion:', error);
    return NextResponse.json({ error: 'Failed to add suggestion' }, { status: 500 });
  }
}
