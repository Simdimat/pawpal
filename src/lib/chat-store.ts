// src/lib/chat-store.ts
// Simple in-memory store for user threads for the OpenAI Assistant API.
// Note: Data stored here will be lost on server restart.
// For a production application, consider a persistent database.

interface UserThread {
  thread_id: string;
  last_seen?: number; // Optional: for potential cleanup of old threads
}

export const userThreads: Record<string, UserThread> = {};
