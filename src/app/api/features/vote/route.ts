
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid feature request ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('feature_requests').updateOne(
      { _id: new ObjectId(id) },
      { $inc: { votes: 1 } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Feature request not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Vote recorded successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error recording vote:', error);
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
  }
}
