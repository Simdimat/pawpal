// In-memory store for a secondary (e.g., "healing") chatbot assistant.
// This keeps its threads separate from the main PawPal chat threads.
// Note: Data stored here will be lost on server restart.

interface UserThread {
  thread_id: string;
  last_seen?: number; 
}

export const healingChatThreads: Record<string, UserThread> = {};
