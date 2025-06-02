'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import FeedbackModal from '../FeedbackModal'; // Ensure this component is created

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [aiResponseCountInSession, setAiResponseCountInSession] = useState(0);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Generate a session ID when component mounts or when a new chat logically starts
    setCurrentSessionId(`session_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    setAiResponseCountInSession(0); // Reset for new session
  }, []);


  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const userIdentifier = localStorage.getItem('pawpal_user_email') || sessionStorage.getItem('pawpal_browser_id') || 'anonymous_user';

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userMessage.text,
          user_identifier: userIdentifier,
          session_id: currentSessionId,
          // conversation_history: messages, // Could send history for context
         }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseText = '';
      const aiMessageId = `ai_${Date.now()}`;

      // Add a placeholder for AI message
      setMessages((prev) => [...prev, { id: aiMessageId, text: '', sender: 'ai', timestamp: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        aiResponseText += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, text: aiResponseText } : msg
          )
        );
      }
      
      // Final AI message update is implicitly done by the loop.
      // Now handle post-AI response logic
      const newAiResponseCount = aiResponseCountInSession + 1;
      setAiResponseCountInSession(newAiResponseCount);

      // Trigger feedback modal after the second AI response in the session
      // Note: This logic assumes session_id is stable for a "conversation topic"
      // And feedback_prompted_for_session would be checked/set on backend
      if (newAiResponseCount === 2 && currentSessionId) {
         // In a real app, you might check a backend flag if feedback was already prompted for this session
        setFeedbackSessionId(currentSessionId);
        setShowFeedbackModal(true);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Could not get response from PawPal. Please try again.',
        variant: 'destructive',
      });
      // Remove placeholder AI message on error or add error message
      setMessages((prev) => prev.filter(msg => msg.id !== `ai_${Date.now()}`)); // This ID might mismatch
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedbackSubmit = async (feedbackText: string) => {
    if (!feedbackSessionId) return;
    // console.log('Feedback submitted for session:', feedbackSessionId, 'Feedback:', feedbackText);
    // API call to /api/user/feedback
    const userIdentifier = localStorage.getItem('pawpal_user_email') || sessionStorage.getItem('pawpal_browser_id') || 'anonymous_user';
    try {
      await fetch('/api/user/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_identifier: userIdentifier,
          session_id: feedbackSessionId,
          feedback_text: feedbackText,
        }),
      });
      toast({ title: 'Feedback Submitted', description: 'Thank you for your feedback!' });
    } catch (error) {
      toast({ title: 'Error', description: 'Could not submit feedback.', variant: 'destructive' });
    }
    setShowFeedbackModal(false);
    setFeedbackSessionId(null);
     // Potentially mark session as feedback given to prevent re-prompting
  };


  return (
    <>
      <ScrollArea className="h-[50vh] w-full p-4 border-t border-b" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex items-end gap-2',
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.sender === 'ai' && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png" alt="PawPal AI" data-ai-hint="robot dog" />
                  <AvatarFallback><Bot size={18}/></AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-[70%] rounded-lg px-4 py-2 text-sm shadow',
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-card-foreground border'
                )}
              >
                {message.text || (message.sender === 'ai' && <Loader2 className="h-4 w-4 animate-spin" />)}
                 <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {message.sender === 'user' && (
                 <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="person avatar"/>
                  <AvatarFallback><User size={18}/></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
           {isLoading && messages[messages.length -1]?.sender === 'user' && (
             <div className="flex items-end gap-2 justify-start">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png" alt="PawPal AI" data-ai-hint="robot dog" />
                  <AvatarFallback><Bot size={18}/></AvatarFallback>
                </Avatar>
                <div className="max-w-[70%] rounded-lg px-4 py-2 text-sm shadow bg-card text-card-foreground border">
                    <Loader2 className="h-4 w-4 animate-spin" />
                </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleSendMessage} className="p-4 flex items-center gap-2 border-t bg-background sticky bottom-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask PawPal anything about pets in San Diego..."
          className="flex-grow focus-visible:ring-primary"
          disabled={isLoading}
          aria-label="Chat input"
        />
        <Button type="submit" disabled={isLoading || !input.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Send</span>
        </Button>
      </form>
      {showFeedbackModal && feedbackSessionId && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => {
            setShowFeedbackModal(false);
            setFeedbackSessionId(null);
          }}
          onSubmit={handleFeedbackSubmit}
          sessionId={feedbackSessionId}
        />
      )}
    </>
  );
};

export default ChatInterface;
