
// src/lib/healing-chat-store.ts
// Simple in-memory store for user threads for the Healing Companion chatbot.
// This keeps its state separate from the PawPal chatbot.
// Note: Data stored here will be lost on server restart.

interface UserThread {
  thread_id: string;
  last_seen?: number;
}

export const healingUserThreads: Record<string, UserThread> = {};
