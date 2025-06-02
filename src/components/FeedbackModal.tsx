'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedbackText: string, helpful?: boolean) => void;
  sessionId: string; // To associate feedback with a session
}

const FeedbackModal = ({ isOpen, onClose, onSubmit, sessionId }: FeedbackModalProps) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [isHelpful, setIsHelpful] = useState<boolean | undefined>(undefined);

  const handleSubmit = () => {
    onSubmit(feedbackText, isHelpful);
    setFeedbackText('');
    setIsHelpful(undefined);
    onClose(); 
  };

  const handleQuickFeedback = (helpful: boolean) => {
    setIsHelpful(helpful);
    onSubmit(feedbackText || (helpful ? "Helpful" : "Not helpful"), helpful); // Send canned text if textarea empty
    setFeedbackText(''); 
    setIsHelpful(undefined);
    onClose();
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">How was that response?</DialogTitle>
          <DialogDescription>
            Your feedback helps PawPal get better! Was the last answer helpful? (Session: ...{sessionId.slice(-6)})
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex justify-center gap-4 mb-4">
            <Button 
              variant={isHelpful === true ? "default" : "outline"} 
              onClick={() => handleQuickFeedback(true)}
              className="bg-green-500 hover:bg-green-600 text-white data-[state=active]:bg-green-600"
            >
              <ThumbsUp className="mr-2 h-4 w-4" /> Helpful
            </Button>
            <Button 
              variant={isHelpful === false ? "default" : "outline"} 
              onClick={() => handleQuickFeedback(false)}
              className="bg-red-500 hover:bg-red-600 text-white data-[state=active]:bg-red-600"
            >
              <ThumbsDown className="mr-2 h-4 w-4" /> Not Helpful
            </Button>
          </div>
          <Textarea
            id="feedbackInputTextarea"
            placeholder="Tell us more (optional)..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Skip / Close
          </Button>
          <Button type="button" onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;
