
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PawPrint, Loader2, AlertCircle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeatureRequest {
  _id: string;
  text: string;
  votes: number;
}

const inProgressFeatures = [
  "Full login and password feature",
  "Improved mobile layout",
  "Enhanced map filters",
];

const initialFeatures = [
  { text: 'Basic dark mode toggle', votes: 5, createdAt: new Date() },
  { text: 'Daily dog fact / tip', votes: 4, createdAt: new Date() },
  { text: 'Simple pet care checklist', votes: 3, createdAt: new Date() },
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
    const voted = sessionStorage.getItem('pawpal_voted_requests');
    if (voted) {
      setVotedRequests(new Set(JSON.parse(voted)));
    }
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/features');
      if (!res.ok) throw new Error('Failed to fetch requests. Please try again.');
      const data: FeatureRequest[] = await res.json();
      
      // If the database returns empty, use initial features as a fallback for display
      if (data.length === 0) {
          const fallbackData = initialFeatures.map((f, i) => ({ ...f, _id: `fallback-${i}`}));
          setRequests(fallbackData);
      } else {
          setRequests(data);
      }

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (id: string) => {
    if (votedRequests.has(id)) {
      toast({ title: "Already Voted!", description: "You can only give one 'Paws Up' per feature." });
      return;
    }
    
    // Handle voting for fallback data locally without API call
    if (id.startsWith('fallback-')) {
        toast({ title: "Demo Vote!", description: "This is a placeholder. Your vote isn't saved, but we appreciate the enthusiasm!"});
        // Optimistic UI update for demo
        setVotedRequests(prev => new Set(prev).add(id));
        setRequests(prev =>
            prev.map(r => (r._id === id ? { ...r, votes: r.votes + 1 } : r)).sort((a, b) => b.votes - a.votes)
        );
        return;
    }

    const newVotedSet = new Set(votedRequests);
    newVotedSet.add(id);
    setVotedRequests(newVotedSet);
    sessionStorage.setItem('pawpal_voted_requests', JSON.stringify(Array.from(newVotedSet)));

    // Optimistic UI update for real data
    setRequests(prev =>
      prev.map(r => (r._id === id ? { ...r, votes: r.votes + 1 } : r)).sort((a, b) => b.votes - a.votes)
    );

    try {
      const res = await fetch('/api/features/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
       if (!res.ok) throw new Error('Server error, vote not saved.');
    } catch (e) {
      // Revert optimistic update on failure
      setRequests(prev =>
        prev.map(r => (r._id === id ? { ...r, votes: r.votes - 1 } : r)).sort((a, b) => b.votes - a.votes)
      );
      const revertedVotedSet = new Set(votedRequests);
      revertedVotedSet.delete(id);
      setVotedRequests(revertedVotedSet);
      sessionStorage.setItem('pawpal_voted_requests', JSON.stringify(Array.from(revertedVotedSet)));
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
      toast({ title: "Suggestion Submitted!", description: "Thanks! Your idea is under review. 🐶" });
      // No longer refreshing the list automatically: await fetchRequests(); 
    } catch (e: any) {
      toast({ title: "Submission Failed", description: e.message || "Could not save your suggestion.", variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full">
      <Card className="bg-primary/10 dark:bg-card shadow-lg border-primary/20">
        <CardContent className="p-8 grid md:grid-cols-2 gap-x-12 gap-y-8">
          
          <div className="space-y-4">
            <h3 className="text-center text-2xl font-bold text-foreground">Currently In Progress & Coming Soon</h3>
            <ul className="space-y-2 text-foreground/90 pl-4">
              {inProgressFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="text-center">
               <h3 className="text-2xl font-bold text-foreground">Feature Requests</h3>
                <p className="text-muted-foreground text-sm">
                  Vote <b>Paws Up</b> for any new features, updates, or improvements you’d like to see here.
                  <br />
                  See your own idea below after a quick review!
                </p>
            </div>
            
            <form onSubmit={handleSubmitSuggestion} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Suggest your idea..."
                value={newSuggestion}
                onChange={e => setNewSuggestion(e.target.value)}
                disabled={isSubmitting}
                className="bg-background"
                aria-label="Suggest a new feature"
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
              </Button>
            </form>
            
            <div className="space-y-2">
              {isLoading && <div className="flex justify-center items-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
              {error && !isLoading && <div className="text-red-500 text-sm flex items-center gap-2 p-2"><AlertCircle size={16} /> {error}</div>}
              
              {!isLoading && !error && requests.length > 0 && (
                <ul className="space-y-2">
                  {requests.map(req => (
                    <li key={req._id} className="flex items-center justify-between bg-background/50 p-3 border-2 border-dashed border-primary/30 rounded-lg">
                      <span className="text-sm mr-2">{req.text}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVote(req._id)}
                        disabled={votedRequests.has(req._id)}
                        className="flex items-center gap-2 rounded-full px-3 shrink-0"
                        aria-label={`Vote for ${req.text}`}
                      >
                        <PawPrint size={16} className={votedRequests.has(req._id) ? "text-accent fill-accent/30" : "text-accent"} />
                        <span className="font-bold text-sm">{req.votes}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
               {!isLoading && !error && requests.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No feature requests yet. Be the first to suggest one!</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default FeatureRequests;
