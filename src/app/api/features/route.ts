
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

// Initial data to seed the collection if it's empty
const initialFeatures = [
  { text: 'Basic dark mode toggle', votes: 5, createdAt: new Date() },
  { text: 'Daily dog fact / tip', votes: 4, createdAt: new Date() },
  { text: 'Simple pet care checklist', votes: 3, createdAt: new Date() },
];

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('feature_requests');
    
    let requests = await collection.find({}).sort({ votes: -1 }).toArray();

    // If the collection is empty, seed it with the initial feature requests
    if (requests.length === 0) {
      await collection.insertMany(initialFeatures);
      // Fetch again to get the newly inserted documents with their generated _id
      requests = await collection.find({}).sort({ votes: -1 }).toArray();
    }

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
