import ChatInterface from '@/components/chat/ChatInterface';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ChatPage() {
  return (
    <div className="flex flex-col items-center w-full">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">Ask PawPal AI</CardTitle>
          <CardDescription className="text-foreground/80">
            Your friendly AI assistant for San Diego pet questions.
            Type your question below and PawPal will do its best to help!
          </CardDescription>
        </CardHeader>
        <ChatInterface />
      </Card>
    </div>
  );
}
