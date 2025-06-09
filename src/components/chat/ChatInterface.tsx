
'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot, Loader2, HelpCircle, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'context-info';
  timestamp: Date;
}

const suggestedQuestionsList = [
  "My dog got sprayed by a skunk! What do I do?",
  "Where's a good dog beach in San Diego?",
  "Any recommendations for Tijuana vet care?",
  "Find shelters for dog walking.",
];

const getChatUserId = (): string => {
  let userId = localStorage.getItem('pawpal_chat_user_id'); 
  if (!userId) {
    userId = `user_openai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('pawpal_chat_user_id', userId);
  }
  return userId;
};


const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingContext, setIsFetchingContext] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const id = getChatUserId();
    setChatUserId(id);

    const loadHistory = async (currentUserId: string) => {
      if (!currentUserId) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/chat-history?user_id=${encodeURIComponent(currentUserId)}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to parse history error" }));
          throw new Error(errorData.error || `Failed to load chat history. Status: ${response.status}`);
        }
        const data = await response.json();
        if (data.conversation && data.conversation.length > 0) {
          setMessages(data.conversation.map((msg: any) => ({
            id: msg.id,
            text: msg.text,
            sender: msg.sender,
            timestamp: new Date(msg.timestamp),
          })));
          setShowSuggestions(false);
        } else {
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        toast({ title: 'History Error', description: (error as Error).message, variant: 'destructive' });
        setShowSuggestions(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
        loadHistory(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const noResultsOrErrorMessages = [
      "No specific discussions found", 
      "Could not extract a concise summary",
      "Could not find specific community discussions", 
      "Could not fetch Reddit context",
      "Error fetching Reddit context",
      "Error fetching context from r/sandiego",
      "Error fetching general Reddit context",
      "No relevant Yelp listings found",
      "Error fetching Yelp context",
      "No Petfinder organizations found",
      "No relevant Petfinder shelter or rescue listings",
      "Error fetching Petfinder context"
    ];

  const isContextValidAndNotEmpty = (context: string | null | undefined, source: string | null | undefined): boolean => {
    if (!context || !source || source === 'none') {
      return false;
    }
    return !noResultsOrErrorMessages.some(msg => context.includes(msg));
  };
  
  const fetchContextAPI = async (apiEndpoint: string, query: string, contextName: string): Promise<{ context: string | null; source: string | null }> => {
    setIsFetchingContext(true);
    const contextMsgId = `context_${contextName}_${Date.now()}`;
    setMessages((prev) => [...prev, {id: contextMsgId, text: `Checking for relevant ${contextName} data...`, sender: 'context-info', timestamp: new Date()}]);

    try {
      const response = await fetch(`${apiEndpoint}?query=${encodeURIComponent(query)}`);
      setMessages(prev => prev.filter(m => m.id !== contextMsgId)); 

      if (!response.ok) {
        console.warn(`[ChatInterface] Failed to fetch ${contextName} context, API responded with non-OK status:`, response.status);
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.context || errorData?.error || `Could not fetch ${contextName} context.`;
        setMessages((prev) => [...prev, {id: `context_error_${contextName}_${Date.now()}`, text: `ℹ️ ${errorMessage}`, sender: 'context-info', timestamp: new Date()}]);
        return { context: null, source: null };
      }
      const data: { context: string; source: string } = await response.json();
      console.log(`[ChatInterface] Data from ${apiEndpoint} (${contextName}):`, data);
      return data; // data should include { context: "...", source: "..." }
    } catch (error) {
      console.error(`[ChatInterface] Error fetching ${contextName} context:`, error);
      setMessages(prev => prev.filter(m => m.id !== contextMsgId)); 
      setMessages((prev) => [...prev, {id: `context_error_${contextName}_${Date.now()}`, text: `ℹ️ Error fetching ${contextName} context. Proceeding without it.`, sender: 'context-info', timestamp: new Date()}]);
      return { context: null, source: null };
    } finally {
      // SetIsFetchingContext will be handled by the calling function after all attempts
    }
  };


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
    
    if (showSuggestions) setShowSuggestions(false);
    
    let augmentedMessage = messageText;
    let contextForPrompt: string | null = null;
    let contextSourceUsed: string | null = null;

    setIsFetchingContext(true); // Set loading true at the start of context fetching

    // 1. Try Reddit Context
    const redditData = await fetchContextAPI('/api/reddit-context', messageText, 'Reddit');
    if (isContextValidAndNotEmpty(redditData.context, redditData.source)) {
      contextForPrompt = redditData.context;
      contextSourceUsed = redditData.source; // Will be 'r/sandiego' or 'general_reddit'
      console.log(`[ChatInterface] Using Reddit context from ${contextSourceUsed}.`);
    }

    // 2. If no valid Reddit context, try Yelp Context
    if (!contextForPrompt) {
      const yelpData = await fetchContextAPI('/api/yelp-context', messageText, 'Yelp');
      if (isContextValidAndNotEmpty(yelpData.context, yelpData.source)) {
        contextForPrompt = yelpData.context;
        contextSourceUsed = yelpData.source; // Will be 'yelp'
        console.log(`[ChatInterface] Using Yelp context.`);
      }
    }

    // 3. If no valid Reddit or Yelp context, try Petfinder Context
    if (!contextForPrompt) {
      const petfinderData = await fetchContextAPI('/api/petfinder-context', messageText, 'Petfinder');
      if (isContextValidAndNotEmpty(petfinderData.context, petfinderData.source)) {
        contextForPrompt = petfinderData.context;
        contextSourceUsed = petfinderData.source; // Will be 'petfinder'
        console.log(`[ChatInterface] Using Petfinder context.`);
      }
    }
    
    setIsFetchingContext(false); // Set loading false after all context fetching attempts

    if (contextForPrompt && contextSourceUsed) {
      const cleanedContext = contextForPrompt.replace(/\n{2,}/g, '\n').trim();
      let contextHeader = "Consider this from external data:\n"; // Default header

      if (contextSourceUsed === 'r/sandiego') {
        contextHeader = "Consider this from recent community discussions on r/sandiego:\n";
        setMessages((prev) => [...prev, {id: `context_added_${Date.now()}`, text: `ℹ️ I've included some recent insights from r/sandiego in my considerations.`, sender: 'context-info', timestamp: new Date()}]);
      } else if (contextSourceUsed === 'general_reddit') {
        contextHeader = "Consider this from recent community discussions on general Reddit community discussions:\n";
         setMessages((prev) => [...prev, {id: `context_added_${Date.now()}`, text: `ℹ️ I've included some recent insights from general Reddit community discussions in my considerations.`, sender: 'context-info', timestamp: new Date()}]);
      } else if (contextSourceUsed === 'yelp') {
        contextHeader = "Consider this from Yelp reviews and listings:\n";
        setMessages((prev) => [...prev, {id: `context_added_${Date.now()}`, text: `ℹ️ I've included some information from Yelp in my considerations.`, sender: 'context-info', timestamp: new Date()}]);
      } else if (contextSourceUsed === 'petfinder') {
        contextHeader = "Consider this from Petfinder shelter data:\n";
        setMessages((prev) => [...prev, {id: `context_added_${Date.now()}`, text: `ℹ️ I've included some information from Petfinder in my considerations.`, sender: 'context-info', timestamp: new Date()}]);
      }
      
      augmentedMessage = `${messageText}\n\n${contextHeader}${cleanedContext}`;
      console.log(`[ChatInterface] Context from ${contextSourceUsed} was added to the prompt. actualContextWasAddedToPrompt = true`);
    } else {
      console.log(`[ChatInterface] No suitable external context was found or added to prompt. actualContextWasAddedToPrompt = false.`);
       // Optionally, inform user if all sources failed.
       // setMessages((prev) => [...prev, {id: `context_info_${Date.now()}`, text: `ℹ️ I couldn't find specific local details for this, but I'll answer based on my general knowledge.`, sender: 'context-info', timestamp: new Date()}]);
    }
    
    console.log('[ChatInterface] Sending to /api/chat. Augmented message:', JSON.stringify(augmentedMessage));
    setIsLoading(true);
    let aiMessageId = `ai_${Date.now()}`; 

    try {
      const response = await fetch('/api/chat', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: chatUserId,
          message: augmentedMessage, 
        }),
      });

      if (!response.ok) {
        let serverErrorMessage = 'Failed to get response from PawPal.';
        try {
          const errorBody = await response.json();
          serverErrorMessage = errorBody.details || errorBody.error || (errorBody.verboseErrorDetails ? `${errorBody.verboseErrorDetails} (Status: ${response.status})` : serverErrorMessage);
        } catch (parseError) {
          console.warn('[ChatInterface] Failed to parse error response JSON:', parseError);
        }
        throw new Error(serverErrorMessage);
      }
      
      if (!response.body) {
        throw new Error('Response body is null. Cannot process stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let aiPartialResponse = '';
      
      const aiPlaceholderMessage: Message = {
        id: aiMessageId,
        text: '', 
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiPlaceholderMessage]);

      let doneStreaming = false;
      while (!doneStreaming) {
        const { done, value } = await reader.read();
        if (done) {
          doneStreaming = true;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.substring('data: '.length).trim();
            if (raw === '[DONE]') {
              doneStreaming = true; 
              break; 
            }
            if (raw.startsWith("[ERROR]")) {
              console.error("[ChatInterface] SSE Stream Error:", raw);
              const streamedErrorMsg = raw.substring("[ERROR] ".length);
              let finalErrorMsg = "Server indicated an error in the stream.";
              try {
                  const parsedError = JSON.parse(streamedErrorMsg);
                  finalErrorMsg = parsedError.message || parsedError.error || parsedError.detail || streamedErrorMsg;
              } catch (e) {
                  finalErrorMsg = streamedErrorMsg; 
              }
              throw new Error(`Stream Error: ${finalErrorMsg}`);
            }
            try {
              const token = JSON.parse(raw);
              aiPartialResponse += token;
              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === aiMessageId ? { ...msg, text: aiPartialResponse } : msg
                )
              );
            } catch (e) {
              console.warn('[ChatInterface] Failed to parse token JSON from stream:', raw, e);
            }
          }
        }
         if (doneStreaming) break; 
      }

      let finalAiText = aiPartialResponse;
      if (contextSourceUsed) {
        let sourceLabel = "external data";
        if (contextSourceUsed === 'r/sandiego') sourceLabel = "r/sandiego";
        else if (contextSourceUsed === 'general_reddit') sourceLabel = "Reddit";
        else if (contextSourceUsed === 'yelp') sourceLabel = "Yelp";
        else if (contextSourceUsed === 'petfinder') sourceLabel = "Petfinder";
        
        finalAiText += ` (Derived from ${sourceLabel}!)`;
        console.log(`[ChatInterface] Appending "(Derived from ${sourceLabel}!)" to AI response.`);
      } else {
        console.log('[ChatInterface] Not appending derivation tag as no specific contextSourceUsed.');
      }


      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === aiMessageId ? { ...msg, text: finalAiText } : msg
        )
      );

    } catch (error) {
      console.error('[ChatInterface] Error sending message or processing response:', error);
      const errorMessage = (error instanceof Error && error.message) 
        ? error.message 
        : 'Could not get response from PawPal. Please try again.';
      toast({
        title: 'Chat Error',
        description: errorMessage.substring(0, 300),
        variant: 'destructive',
      });
      
      const existingAiMsgIndex = messages.findIndex(msg => msg.id === aiMessageId && msg.text === '');
      if (existingAiMsgIndex > -1) {
           setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === aiMessageId ? { ...msg, text: `Sorry, I encountered an error: ${errorMessage.substring(0,100)}...` } : msg
            )
          );
      } else if (!messages.some(msg => msg.id === aiMessageId)) { 
          const errorPlaceholderMessage: Message = {
            id: `ai_error_${Date.now()}`,
            text: `Sorry, I encountered an error: ${errorMessage.substring(0,100)}...`,
            sender: 'ai',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorPlaceholderMessage]);
      }
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
               {message.sender === 'context-info' && (
                <Avatar className="h-8 w-8 opacity-70">
                  <AvatarFallback><MessageSquareText size={18} className="text-blue-500"/></AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-[70%] rounded-lg px-4 py-2 text-sm shadow whitespace-pre-wrap',
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : message.sender === 'ai'
                    ? 'bg-card text-card-foreground border'
                    : 'bg-blue-50 border border-blue-200 text-blue-700 text-xs italic'
                )}
              >
                {message.text || (message.sender === 'ai' && isLoading && messages.length > 0 && messages[messages.length -1]?.id === message.id && <Loader2 className="h-4 w-4 animate-spin" />)}
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
           { (isLoading || isFetchingContext) && messages[messages.length-1]?.sender === 'user' && !messages.some(m => m.sender === 'context-info' && m.text.includes('Checking for relevant')) && (
             <div className="flex items-end gap-2 justify-start">
                <Avatar className="h-8 w-8">
                    <AvatarImage src="https://placehold.co/40x40.png" alt="PawPal AI" data-ai-hint="robot dog" />
                    <AvatarFallback><Bot size={18}/></AvatarFallback>
                </Avatar>
                <div className="max-w-[70%] rounded-lg px-4 py-2 text-sm shadow whitespace-pre-wrap bg-card text-card-foreground border">
                    <Loader2 className="h-4 w-4 animate-spin" /> 
                    {isFetchingContext && <span className="ml-2 text-xs italic">Thinking...</span>}
                </div>
             </div>
           )}
        </div>
      </ScrollArea>

      {showSuggestions && messages.length === 0 && !isLoading && !isFetchingContext && (
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
          disabled={isLoading || isFetchingContext}
          aria-label="Chat input"
        />
        <Button type="submit" disabled={isLoading || isFetchingContext || !input.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {(isLoading || isFetchingContext) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
};

export default ChatInterface;

