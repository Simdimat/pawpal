
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PawPrint, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';

interface FeatureRequest {
  _id: string;
  text: string;
  votes: number;
}

const inProgressFeatures = [
  "AI-powered pet adoption matching service.",
  "Integration with local dog training classes.",
  "Community forum for pet owners.",
  "Real-time alerts for lost pets in the area.",
];

const FeatureRequests = () => {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [newSuggestion, setNewSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votedRequests, setVotedRequests] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    // Load voted requests from session storage
    const voted = sessionStorage.getItem('pawpal_voted_requests');
    if (voted) {
      setVotedRequests(new Set(JSON.parse(voted)));
    }
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/features');
      if (!res.ok) throw new Error('Failed to fetch feature requests.');
      const data: FeatureRequest[] = await res.json();
      setRequests(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (id: string) => {
    if (votedRequests.has(id)) {
      toast({ title: "Already Voted!", description: "You can only give one 'Paws Up' per feature.", variant: 'default' });
      return;
    }

    const newVotedSet = new Set(votedRequests);
    newVotedSet.add(id);
    setVotedRequests(newVotedSet);
    sessionStorage.setItem('pawpal_voted_requests', JSON.stringify(Array.from(newVotedSet)));

    // Optimistic UI update
    setRequests(prev =>
      prev.map(r => (r._id === id ? { ...r, votes: r.votes + 1 } : r)).sort((a, b) => b.votes - a.votes)
    );

    try {
      await fetch('/api/features/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (e) {
      // Revert optimistic update on error
      setRequests(prev =>
        prev.map(r => (r._id === id ? { ...r, votes: r.votes - 1 } : r)).sort((a, b) => b.votes - a.votes)
      );
      toast({ title: "Vote Failed", description: "Could not save your vote. Please try again.", variant: 'destructive' });
    }
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestion.trim()) {
      toast({ title: "Empty Suggestion", description: "Please enter a feature idea.", variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion: newSuggestion }),
      });
      if (!res.ok) throw new Error('Failed to submit suggestion.');
      setNewSuggestion('');
      toast({ title: "Suggestion Submitted!", description: "Thanks for your feedback! 🐶" });
      await fetchRequests(); // Refresh the list
    } catch (e: any) {
      setError(e.message);
      toast({ title: "Submission Failed", description: "Could not save your suggestion.", variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full">
      <Card className="bg-white/50 dark:bg-black/20 shadow-lg border-primary/20">
        <CardContent className="p-6 grid md:grid-cols-2 gap-8">
          {/* In Progress Section */}
          <div>
            <CardHeader className="p-0 mb-4">
              <CardTitle className="font-headline text-2xl text-primary">Currently In Progress & Coming Soon</CardTitle>
              <CardDescription>Features we're actively developing based on your feedback.</CardDescription>
            </CardHeader>
            <ul className="space-y-2 list-disc list-inside text-foreground/90">
              {inProgressFeatures.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>

          {/* Feature Requests Section */}
          <div>
            <CardHeader className="p-0 mb-4">
              <CardTitle className="font-headline text-2xl text-primary">Feature Requests</CardTitle>
              <CardDescription>Vote for your favorite ideas or suggest a new one!</CardDescription>
            </CardHeader>
            
            <ScrollArea className="h-48 pr-4 mb-4">
              {isLoading && <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
              {error && <div className="text-red-500 flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
              {!isLoading && !error && (
                <ul className="space-y-3">
                  {requests.map(req => (
                    <li key={req._id} className="flex items-center justify-between bg-secondary/50 p-2 rounded-md">
                      <span className="text-sm">{req.text}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVote(req._id)}
                        disabled={votedRequests.has(req._id)}
                        className="gap-1"
                      >
                        <PawPrint size={14} className={votedRequests.has(req._id) ? "text-primary fill-primary/20" : "text-primary"} />
                        {req.votes}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>

            <form onSubmit={handleSubmitSuggestion} className="flex items-center gap-2 mt-4">
              <Input
                type="text"
                placeholder="Suggest a new feature for PawPal..."
                value={newSuggestion}
                onChange={e => setNewSuggestion(e.target.value)}
                disabled={isSubmitting}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suggest'}
              </Button>
            </form>

          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default FeatureRequests;
