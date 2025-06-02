'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Mail, LogOut, UserCircle } from 'lucide-react';

const EmailAuth = () => {
  const [email, setEmail] = useState('');
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedEmail = localStorage.getItem('pawpal_user_email');
    if (savedEmail) {
      setStoredEmail(savedEmail);
    }
  }, []);

  const handleSaveEmail = async () => {
    if (!email || !email.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    // Simulate API call to /api/user/save-email
    await new Promise(resolve => setTimeout(resolve, 1000));
    localStorage.setItem('pawpal_user_email', email);
    setStoredEmail(email);
    setIsLoading(false);
    toast({ title: 'Email Saved', description: 'Your email has been saved for chat history.' });
    setEmail(''); // Clear input
  };

  const handleLogout = () => {
    localStorage.removeItem('pawpal_user_email');
    setStoredEmail(null);
    toast({ title: 'Logged Out', description: 'Your email has been removed.' });
  };

  if (storedEmail) {
    return (
      <div className="flex items-center gap-2">
        <UserCircle className="h-5 w-5 text-primary" />
        <span className="text-sm hidden sm:inline">{storedEmail}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Mail className="h-5 w-5 text-muted-foreground hidden sm:block" />
      <Input
        type="email"
        placeholder="Enter email to save history"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-9 w-40 sm:w-48 text-sm"
        aria-label="Enter email to save history"
      />
      <Button size="sm" onClick={handleSaveEmail} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
};

export default EmailAuth;
