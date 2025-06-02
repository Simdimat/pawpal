
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedbackText: string, helpful?: boolean) => void;
  sessionId: string; 
}

const FeedbackModal = ({ isOpen, onClose, onSubmit, sessionId }: FeedbackModalProps) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [isHelpful, setIsHelpful] = useState<boolean | undefined>(undefined);

  const handleSubmitWithDetail = () => {
    onSubmit(feedbackText, isHelpful); // isHelpful might be undefined if only text is provided
    setFeedbackText('');
    setIsHelpful(undefined);
    onClose(); 
  };

  const handleQuickFeedback = (helpful: boolean) => {
    setIsHelpful(helpful); // Set the state for visual feedback on buttons
    // Submit immediately with a canned message if textarea is empty
    // If user later adds text and clicks "Submit Feedback", that will send more detail.
    onSubmit(feedbackText || (helpful ? "Helpful" : "Not helpful"), helpful); 
    setFeedbackText('');
    // setIsHelpful(undefined); // Keep it set to show selection until modal is closed or full submit
    onClose(); // Close after quick feedback
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsHelpful(undefined); // Reset helpful state on close
        setFeedbackText('');
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">How was that response?</DialogTitle>
          <DialogDescription>
            Your feedback helps PawPal get better! (Session ID: ...{sessionId ? sessionId.slice(-6) : 'N/A'})
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex justify-center gap-4 mb-4">
            <Button 
              variant={isHelpful === true ? "default" : "outline"} 
              onClick={() => handleQuickFeedback(true)}
              className={cn(
                "text-white",
                isHelpful === true ? "bg-green-600 hover:bg-green-700" : "bg-green-500 hover:bg-green-600"
              )}
            >
              <ThumbsUp className="mr-2 h-4 w-4" /> Helpful
            </Button>
            <Button 
              variant={isHelpful === false ? "default" : "outline"} 
              onClick={() => handleQuickFeedback(false)}
              className={cn(
                "text-white",
                isHelpful === false ? "bg-red-600 hover:bg-red-700" : "bg-red-500 hover:bg-red-600"
              )}
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
          <Button type="button" variant="outline" onClick={() => {
             setIsHelpful(undefined);
             setFeedbackText('');
             onClose();
          }}>
            Skip / Close
          </Button>
          <Button type="button" onClick={handleSubmitWithDetail} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!feedbackText && isHelpful === undefined}>
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;
