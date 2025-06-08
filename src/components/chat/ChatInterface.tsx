
'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot, Loader2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const suggestedQuestionsList = [
  "My dog got sprayed by a skunk! What do I do?",
  "Where's a good dog beach in San Diego?",
  "Recommend low-cost vet services.",
  "Find shelters for dog walking.",
];

const getChatUserId = (): string => {
  let userId = localStorage.getItem('pawpal_chat_user_id_genkit'); // Use a new key for Genkit chat
  if (!userId) {
    userId = `user_genkit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('pawpal_chat_user_id_genkit', userId);
  }
  return userId;
};


const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const id = getChatUserId();
    setChatUserId(id);
    // For Genkit, we are not loading history initially in Phase 1
    // setShowSuggestions will be true if messages array is empty.
    setShowSuggestions(messages.length === 0);
  }, [messages.length]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const processAndSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !chatUserId) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if (input === messageText) {
        setInput('');
    }
    setIsLoading(true);
    if (showSuggestions) setShowSuggestions(false);

    try {
      const response = await fetch('/api/genkit-chat', { // Updated API endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatUserId: chatUserId, // Pass chatUserId
          question: messageText,
         }),
      });

      setIsLoading(false); // Set loading to false after fetch completes

      if (!response.ok) {
        let serverErrorMessage = 'Failed to get response from PawPal.';
        let errorDetails = `Status: ${response.status}`;
        try {
          const errorBody = await response.json();
          serverErrorMessage = errorBody.error || serverErrorMessage;
          if (errorBody.details) {
            errorDetails += ` - Details: ${errorBody.details}`;
          }
        } catch (parseError) {
          console.warn('Failed to parse error response JSON:', parseError);
          errorDetails += ` - Response body: ${await response.text()}`;
        }
        console.error(`API request failed. ${errorDetails}`);
        throw new Error(`${serverErrorMessage} (${errorDetails})`);
      }
      
      const data = await response.json();
      
      if (data.answer) {
        const aiMessage: Message = {
          id: `ai_${Date.now()}`,
          text: data.answer,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error('Received an empty answer from PawPal AI.');
      }

    } catch (error) {
      setIsLoading(false);
      console.error('Error sending message or processing response:', error);
      const errorMessage = (error instanceof Error && error.message) 
        ? error.message 
        : 'Could not get response from PawPal. Please try again.';
      toast({
        title: 'Chat Error',
        description: errorMessage.substring(0, 300), // Limit length of toast description
        variant: 'destructive',
      });
      // Optionally add an error message to the chat
      const aiErrorMessage: Message = {
        id: `ai_error_${Date.now()}`,
        text: `Sorry, I encountered an error: ${errorMessage.substring(0,100)}...`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiErrorMessage]);
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await processAndSendMessage(input);
  };

  const handleSuggestionClick = async (question: string) => {
    setShowSuggestions(false);
    await processAndSendMessage(question);
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <ScrollArea className="flex-grow w-full p-4 min-h-0" ref={scrollAreaRef}>
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
                  'max-w-[70%] rounded-lg px-4 py-2 text-sm shadow whitespace-pre-wrap',
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-card-foreground border'
                )}
              >
                {message.text || (message.sender === 'ai' && isLoading && messages[messages.length -1]?.id === message.id && <Loader2 className="h-4 w-4 animate-spin" />)}
                 <p className="text-xs opacity-70 mt-1 text-right">
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
           {isLoading && messages[messages.length-1]?.sender === 'user' && (
             <div className="flex items-end gap-2 justify-start">
                <Avatar className="h-8 w-8">
                    <AvatarImage src="https://placehold.co/40x40.png" alt="PawPal AI" data-ai-hint="robot dog" />
                    <AvatarFallback><Bot size={18}/></AvatarFallback>
                </Avatar>
                <div className="max-w-[70%] rounded-lg px-4 py-2 text-sm shadow whitespace-pre-wrap bg-card text-card-foreground border">
                    <Loader2 className="h-4 w-4 animate-spin" />
                </div>
             </div>
           )}
        </div>
      </ScrollArea>

      {showSuggestions && messages.length === 0 && !isLoading && (
        <div className="p-4 border-t bg-background/50">
          <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
            <HelpCircle size={16} />
            Not sure what to ask? Try one of these:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestionsList.map((q, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1.5 px-3 bg-card hover:bg-secondary"
                onClick={() => handleSuggestionClick(q)}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="p-4 flex items-center gap-2 border-t bg-background">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask PawPal..."
          className="flex-grow focus-visible:ring-primary bg-card"
          disabled={isLoading}
          aria-label="Chat input"
        />
        <Button type="submit" disabled={isLoading || !input.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
};

export default ChatInterface;
