
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
  "Where's a good dog beach in San Diego?",
  "Recommend low-cost vet services.",
  "My dog got skunked! What do I do?",
  "Find shelters for dog walking.",
];

const getChatUserId = (): string => {
  let userId = localStorage.getItem('pawpal_chat_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('pawpal_chat_user_id', userId);
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
    setShowSuggestions(messages.length === 0);
  }, [messages.length]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!chatUserId) return;

    const loadConversation = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/chat-history?user_id=${chatUserId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load chat history');
        }
        const data = await response.json();
        if (data.conversation && data.conversation.length > 0) {
          const formattedConversation = data.conversation.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(formattedConversation);
          setShowSuggestions(false);
        } else {
          setShowSuggestions(true);
        }
      } catch (error: any) {
        console.error('Error loading conversation:', error);
        toast({
          title: 'Error loading history',
          description: error.message,
          variant: 'destructive',
        });
        setShowSuggestions(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadConversation();
  }, [chatUserId, toast]);


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

    let aiMessageIdForErrorHandling: string | null = null;
    let currentAiResponseText = '';
    const aiMessageId = `ai_${Date.now()}`;
    aiMessageIdForErrorHandling = aiMessageId;

    setMessages((prev) => [...prev, { id: aiMessageId, text: '', sender: 'ai', timestamp: new Date() }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: chatUserId,
          message: messageText,
         }),
      });

      if (!response.ok) {
        let serverErrorMessage = 'Failed to get response from PawPal.';
        let errorDetails = '';
        try {
          const errorBody = await response.json();
          if (errorBody && typeof errorBody.details === 'string') {
            errorDetails = errorBody.details;
            serverErrorMessage = `PawPal AI service error: ${errorBody.details}`;
          } else if (errorBody && typeof errorBody.error === 'string') {
            errorDetails = errorBody.error;
            serverErrorMessage = `PawPal AI service error: ${errorBody.error}`;
          }
        } catch (parseError) {
          console.warn('Failed to parse error response JSON:', parseError);
          // serverErrorMessage remains generic if parsing fails
        }
        // Log the more detailed error if available, otherwise the generic one
        console.error(`API request failed with status ${response.status}. Error: ${errorDetails || serverErrorMessage}`);
        throw new Error(errorDetails || serverErrorMessage); // Throw the more specific error if available
      }
      
      if (!response.body) {
        throw new Error('API call successful but no response body was received for streaming.');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          
          const raw = line.slice("data: ".length).trim();

          if (raw === "[DONE]") {
            console.log("SSE Stream [DONE]");
            continue; 
          }
          // Check if raw starts with [ERROR]
          if (raw.startsWith("[ERROR]")) {
            console.error("SSE Stream Error:", raw);
            const streamedErrorMsg = raw.substring("[ERROR] ".length);
            // Try to parse if it's JSON, otherwise use as string
            let finalErrorMsg = "Server indicated an error in the stream.";
            try {
              finalErrorMsg = JSON.parse(streamedErrorMsg);
            } catch (e) {
              finalErrorMsg = streamedErrorMsg; // Use as is if not JSON
            }
            throw new Error(finalErrorMsg);
          }

          try {
            const token = JSON.parse(raw);
            if (typeof token === 'string') {
                currentAiResponseText += token;
                setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMessageId ? { ...msg, text: currentAiResponseText } : msg
                )
                );
            }
          } catch (e) {
              console.error("Error parsing token JSON from SSE:", raw, e);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message or processing stream:', error);
      const errorMessage = (error instanceof Error && error.message) 
        ? error.message 
        : 'Could not get response from PawPal. Please try again.';
      toast({
        title: 'Chat Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setMessages((prevMessages) => 
        prevMessages.map(msg => 
          msg.id === aiMessageIdForErrorHandling ? {...msg, text: `Error: ${errorMessage.substring(0,100)}...`} : msg
        ).filter(msg => !(msg.id === aiMessageIdForErrorHandling && msg.text ===''))
      );
    } finally {
      setIsLoading(false);
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
