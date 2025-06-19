
'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot, Loader2, HelpCircle, MessageSquareText, AlertTriangleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'context-info' | 'debug-info';
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
      "no specific discussions found",
      "could not extract a concise summary",
      "could not find specific community discussions",
      "could not fetch reddit context",
      "error fetching reddit context",
      "error fetching context from r/sandiego",
      "error fetching general reddit context",
      "no relevant yelp listings found",
      "error fetching yelp context",
      "no petfinder organizations found",
      "no relevant petfinder shelter or rescue listings",
      "error fetching petfinder context",
      "found reddit posts via google, but encountered issues fetching their content",
      "scrapingdog/google search returned no organic results"
    ];

  const isContextValidAndNotEmpty = (context: string | null | undefined, source: string | null | undefined): boolean => {
    console.log('[ChatInterface isContextValidAndNotEmpty] Checking context. Source:', source, 'Context (first 100 chars):', context ? context.substring(0, 100) : 'N/A');
    if (!context || !source || source === 'none') {
      console.log('[ChatInterface isContextValidAndNotEmpty] Invalid: No context, source, or source is "none".');
      return false;
    }
    
    const lowerContext = context.toLowerCase();
    for (const errorMsg of noResultsOrErrorMessages) {
      const lowerErrorMsg = errorMsg.toLowerCase();
      if (lowerContext.includes(lowerErrorMsg)) {
        console.log(`[ChatInterface isContextValidAndNotEmpty] Invalid: Context ("${context.substring(0,50)}...") matched an error/no-result message: "${errorMsg}"`);
        return false;
      }
    }
    
    const isValid = context.trim().length > 0;
    console.log(`[ChatInterface isContextValidAndNotEmpty] Context seems valid. Valid: ${isValid}`);
    return isValid;
  };

  interface ContextAPIResponse {
    context: string;
    source: 'experimental_google_reddit' | 'reddit_direct_search' | 'yelp' | 'petfinder' | 'none' | null;
    debugLogs?: string[];
  }

  const fetchContextAPI = async (apiEndpoint: string, query: string, contextName: string): Promise<ContextAPIResponse> => {
    const contextMsgId = `context_fetch_indicator_${contextName}_${Date.now()}`;
    setMessages((prev) => [...prev, {id: contextMsgId, text: `Checking for relevant ${contextName} data...`, sender: 'context-info', timestamp: new Date()}]);

    try {
      const response = await fetch(`${apiEndpoint}?query=${encodeURIComponent(query)}`);
      setMessages(prev => prev.filter(m => m.id !== contextMsgId)); 

      if (!response.ok) {
        console.warn(`[ChatInterface] Failed to fetch ${contextName} context, API responded with non-OK status:`, response.status);
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.context || errorData?.error || `Could not fetch ${contextName} context.`;
        return { context: errorMessage, source: null, debugLogs: errorData?.debugLogs || [`API Error ${response.status} for ${contextName}`] };
      }
      const data: ContextAPIResponse = await response.json();
      console.log(`[ChatInterface] Data from ${apiEndpoint} (${contextName}):`, data);

      if (data.debugLogs && data.debugLogs.length > 0) {
        data.debugLogs.forEach((log, index) => {
            if (!messages.some(m => m.text.includes(log.substring(0,50)))) { // Avoid duplicate debug logs in UI
                 setMessages((prev) => [...prev, {id: `debug_${contextName}_${Date.now()}_${index}`, text: `🔧 DEBUG (${contextName}): ${log}`, sender: 'debug-info', timestamp: new Date()}]);
            }
        });
      }
      return data;
    } catch (error) {
      console.error(`[ChatInterface] Error fetching ${contextName} context:`, error);
      setMessages(prev => prev.filter(m => m.id !== contextMsgId));
      const errorMessage = `Error fetching ${contextName} context. Proceeding without it.`;
      return { context: errorMessage, source: null, debugLogs: [(error as Error).message || `Client-side fetch error for ${contextName}`] };
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
    let contextAddedMessageForUI: string | null = null; // For the UI message if context is added
    let actualContextWasAddedToPrompt = false;

    setIsFetchingContext(true);

    // --- Attempt to fetch Reddit context ---
    const redditData = await fetchContextAPI('/api/reddit-context', messageText, 'Reddit');
    console.log('[ChatInterface processAndSendMessage] Reddit Data Received:', { context: redditData.context ? redditData.context.substring(0,100) + '...' : 'N/A', source: redditData.source });
    
    const isRedditContextValid = isContextValidAndNotEmpty(redditData.context, redditData.source);
    console.log(`[ChatInterface processAndSendMessage] Result of isContextValidAndNotEmpty for Reddit: ${isRedditContextValid}`);
    const isRedditSourceCorrect = redditData.source === 'experimental_google_reddit' || redditData.source === 'reddit_direct_search';
    console.log(`[ChatInterface processAndSendMessage] Is Reddit source correct ('experimental_google_reddit' || 'reddit_direct_search')? ${isRedditSourceCorrect}`);

    if (isRedditContextValid && isRedditSourceCorrect) {
        console.log('[ChatInterface processAndSendMessage] USING Reddit context for prompt.');
        contextForPrompt = redditData.context;
        contextSourceUsed = redditData.source;
        contextAddedMessageForUI = `ℹ️ I've included some insights from Reddit in my considerations.`;
        actualContextWasAddedToPrompt = true;
    } else if (redditData.context) { 
        console.log('[ChatInterface processAndSendMessage] NOT using Reddit context for prompt. Displaying status message.');
        const redditStatusMessage = `ℹ️ Reddit (${redditData.source || 'Fetch Attempt'}): ${redditData.context.substring(0,150)}${redditData.context.length > 150 ? '...' : ''}`;
        if (!messages.some(m => m.text.includes(redditData.context.substring(0,50)))) { // Avoid duplicate status messages
             setMessages((prev) => [...prev, {id: `context_status_reddit_${Date.now()}`, text: redditStatusMessage, sender: 'context-info', timestamp: new Date()}]);
        }
    }
    console.log(`[ChatInterface processAndSendMessage] After Reddit check: actualContextWasAddedToPrompt = ${actualContextWasAddedToPrompt}`);


    // --- If Reddit context wasn't suitable, try Yelp ---
    if (!actualContextWasAddedToPrompt) {
      console.log('[ChatInterface processAndSendMessage] Reddit context not used for prompt, trying Yelp.');
      const yelpData = await fetchContextAPI('/api/yelp-context', messageText, 'Yelp');
      if (isContextValidAndNotEmpty(yelpData.context, yelpData.source) && yelpData.source === 'yelp') {
        contextForPrompt = yelpData.context;
        contextSourceUsed = yelpData.source;
        contextAddedMessageForUI = `ℹ️ I've included some information from Yelp in my considerations.`;
        actualContextWasAddedToPrompt = true;
      } else if (yelpData.context) {
        const yelpStatusMessage = `ℹ️ Yelp: ${yelpData.context}`;
         if (!messages.some(m => m.text.includes(yelpData.context.substring(0,50)))) {
            setMessages((prev) => [...prev, {id: `context_status_yelp_${Date.now()}`, text: yelpStatusMessage, sender: 'context-info', timestamp: new Date()}]);
         }
      }
    }
    console.log(`[ChatInterface processAndSendMessage] After Yelp check: actualContextWasAddedToPrompt = ${actualContextWasAddedToPrompt}`);

    // --- If still no context, try Petfinder ---
    if (!actualContextWasAddedToPrompt) {
      console.log('[ChatInterface processAndSendMessage] Yelp context not used for prompt, trying Petfinder.');
      const petfinderData = await fetchContextAPI('/api/petfinder-context', messageText, 'Petfinder');
      if (isContextValidAndNotEmpty(petfinderData.context, petfinderData.source) && petfinderData.source === 'petfinder') {
        contextForPrompt = petfinderData.context;
        contextSourceUsed = petfinderData.source;
        contextAddedMessageForUI = `ℹ️ I've included some information from Petfinder in my considerations.`;
        actualContextWasAddedToPrompt = true;
      } else if (petfinderData.context) {
         const petfinderStatusMessage = `ℹ️ Petfinder: ${petfinderData.context}`;
         if (!messages.some(m => m.text.includes(petfinderData.context.substring(0,50)))) {
            setMessages((prev) => [...prev, {id: `context_status_petfinder_${Date.now()}`, text: petfinderStatusMessage, sender: 'context-info', timestamp: new Date()}]);
         }
      }
    }
    console.log(`[ChatInterface processAndSendMessage] After Petfinder check: actualContextWasAddedToPrompt = ${actualContextWasAddedToPrompt}`);

    setIsFetchingContext(false);

    if (contextAddedMessageForUI && actualContextWasAddedToPrompt) { 
        if(!messages.some(m => m.text === contextAddedMessageForUI)) { // Avoid duplicate UI confirmations
            setMessages((prev) => [...prev, {id: `context_added_confirmation_${Date.now()}`, text: contextAddedMessageForUI, sender: 'context-info', timestamp: new Date()}]);
        }
    } else if (!actualContextWasAddedToPrompt && !messages.some(m => m.sender === 'context-info' && m.text.startsWith("ℹ️") && !m.text.includes("Checking for relevant"))) {
        setMessages((prev) => [...prev, {id: `context_status_none_${Date.now()}`, text: `ℹ️ No specific external context found for this query. Proceeding with general knowledge.`, sender: 'context-info', timestamp: new Date()}]);
    }


    if (contextForPrompt && contextSourceUsed && actualContextWasAddedToPrompt) {
      const cleanedContext = contextForPrompt.replace(/\n{2,}/g, '\n').trim();
      let contextHeader = "Consider this external data in your response:\n";

      if (contextSourceUsed === 'reddit_direct_search') {
        contextHeader = "Consider this from recent community discussions on Reddit (found via direct Reddit API search):\n";
      } else if (contextSourceUsed === 'experimental_google_reddit') { 
        contextHeader = "Consider this from recent community discussions on Reddit (found via Google Search):\n";
      } else if (contextSourceUsed === 'yelp') {
        contextHeader = "Consider this from Yelp reviews and listings:\n";
      } else if (contextSourceUsed === 'petfinder') {
        contextHeader = "Consider this from Petfinder shelter data:\n";
      }
      augmentedMessage = `${messageText}\n\n${contextHeader}${cleanedContext}`;
      console.log(`[ChatInterface processAndSendMessage] Context from ${contextSourceUsed} was ADDED to the prompt.`);
    } else {
      console.log(`[ChatInterface processAndSendMessage] No suitable external context was added to prompt. actualContextWasAddedToPrompt = ${actualContextWasAddedToPrompt}, contextSourceUsed = ${contextSourceUsed}`);
    }

    console.log('[ChatInterface processAndSendMessage] Sending to /api/chat. Augmented message (first 500 chars):', JSON.stringify(augmentedMessage.substring(0, 500) + (augmentedMessage.length > 500 ? "..." : "")));
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
      if (actualContextWasAddedToPrompt && contextSourceUsed && aiPartialResponse) { 
        let sourceLabel = "external data";
        if (contextSourceUsed === 'reddit_direct_search' || contextSourceUsed === 'experimental_google_reddit') sourceLabel = "Reddit";
        else if (contextSourceUsed === 'yelp') sourceLabel = "Yelp";
        else if (contextSourceUsed === 'petfinder') sourceLabel = "Petfinder";

        // Append derivation tag only if AI response exists.
        if (finalAiText.trim().length > 0) {
            finalAiText += ` (Derived from ${sourceLabel}!)`;
            console.log(`[ChatInterface processAndSendMessage] Appending "(Derived from ${sourceLabel}!)" to AI response.`);
        } else {
            console.log(`[ChatInterface processAndSendMessage] AI response was empty, not appending derivation tag.`);
        }
      } else if (aiPartialResponse) {
        console.log('[ChatInterface processAndSendMessage] Not appending derivation tag as no specific contextSourceUsed for prompt augmentation, or AI response was empty before tag.');
      }


      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === aiMessageId ? { ...msg, text: finalAiText || "I'm sorry, I couldn't formulate a response for that." } : msg
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
        {messages.length === 0 && showSuggestions && !isLoading && !isFetchingContext ? (
          <div>
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
                  className="text-xs h-auto py-1.5 px-3 bg-card hover:bg-secondary whitespace-normal text-left"
                  onClick={() => handleSuggestionClick(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
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
                 {(message.sender === 'context-info' || message.sender === 'debug-info') && (
                  <Avatar className="h-8 w-8 opacity-70">
                    <AvatarFallback>
                        {message.sender === 'context-info' && <MessageSquareText size={18} className="text-blue-500"/>}
                        {message.sender === 'debug-info' && <AlertTriangleIcon size={18} className="text-orange-500"/>}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-4 py-2 text-sm shadow whitespace-pre-wrap',
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.sender === 'ai'
                      ? 'bg-card text-card-foreground border'
                      : message.sender === 'context-info'
                      ? 'bg-blue-50 border border-blue-200 text-blue-700 text-xs italic'
                      : 'bg-orange-50 border border-orange-300 text-orange-700 text-xs' 
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
          </div>
        )}
        { (isLoading || isFetchingContext) && messages[messages.length-1]?.sender === 'user' && !messages.some(m => m.sender === 'context-info' && m.text.includes('Checking for relevant')) && (
           <div className="flex items-end gap-2 justify-start mt-4">
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
      </ScrollArea>

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

    