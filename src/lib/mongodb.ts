import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient | null = null;
let db: Db | null = null;

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

export async function connectToDatabase(): Promise<{ client: MongoClient, db: Db }> {
  if (client && db) {
    return { client, db };
  }

  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }

  try {
    client = new MongoClient(uri, options);
    await client.connect();
    db = client.db(); // Replace with your database name if it's not in the URI

    console.log('Connected to MongoDB');

    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw new Error('Failed to connect to MongoDB');
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}