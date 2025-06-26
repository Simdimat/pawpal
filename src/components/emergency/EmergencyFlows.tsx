
'use client';

import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface EmergencyStep {
  title: string;
  details: string;
  important?: boolean;
}

interface EmergencyFlow {
  id: string;
  name: string;
  icon?: string; // For future icon integration
  description: string;
  steps: EmergencyStep[];
  immediateActions?: string[];
  relevantContacts?: { name: string; number?: string; website?: string }[];
}

interface EmergencyContext {
  redditAdvice?: string;
}

const EmergencyFlows = () => {
  const [flows, setFlows] = useState<EmergencyFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState<Record<string, boolean>>({});
  const [emergencyContexts, setEmergencyContexts] = useState<Record<string, EmergencyContext>>({});

  useEffect(() => {
    const fetchFlows = async () => {
      try {
        const response = await fetch('/assets/data/emergency_flows.json');
        if (!response.ok) throw new Error('Failed to load emergency data.');
        const data: EmergencyFlow[] = await response.json();
        setFlows(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFlows();
  }, []);

  const fetchEmergencyContext = async (emergencyType: string, flowId: string) => {
    setContextLoading(prev => ({ ...prev, [flowId]: true }));
    try {
      const response = await fetch(`/api/emergency-context?type=${encodeURIComponent(emergencyType)}`);
      if (!response.ok) {
        // Don't throw an error, context is supplementary
        console.warn(`Failed to load context for ${emergencyType}`);
        const errorData = await response.json().catch(() => ({ redditAdvice: "Could not load supplementary advice."}));
        setEmergencyContexts(prev => ({ ...prev, [flowId]: { redditAdvice: errorData.error || "Could not load supplementary advice." } }));
        return;
      }
      const data: { redditAdvice: string } = await response.json();
      setEmergencyContexts(prev => ({ ...prev, [flowId]: data }));
    } catch (e) {
      console.warn(`Error fetching context for ${emergencyType}:`, e);
      setEmergencyContexts(prev => ({ ...prev, [flowId]: { redditAdvice: "Error loading supplementary advice." } }));
    } finally {
      setContextLoading(prev => ({ ...prev, [flowId]: false }));
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading emergency procedures...</p></div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600"><AlertCircle className="mx-auto h-8 w-8 mb-2" />Error: {error}</div>;
  }

  if (flows.length === 0) {
    return <div className="text-center py-10 text-muted-foreground">No emergency procedures available at this time.</div>;
  }

  return (
    <Accordion type="single" collapsible className="w-full space-y-4">
      {flows.map((flow) => (
        <AccordionItem value={flow.id} key={flow.id} className="border rounded-lg shadow-sm bg-card">
          <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline data-[state=open]:border-b">
            {flow.name}
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0">
            <CardDescription className="mb-4">{flow.description}</CardDescription>
            
            {flow.immediateActions && flow.immediateActions.length > 0 && (
              <Card className="mb-4 border-destructive bg-destructive/10">
                <CardHeader>
                  <CardTitle className="text-destructive text-md flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5" /> Immediate Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-destructive/90">
                    {flow.immediateActions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <h4 className="font-semibold mb-2 mt-4 text-md">Steps:</h4>
            <ol className="list-decimal pl-5 space-y-3 text-sm">
              {flow.steps.map((step, index) => (
                <li key={index} className={step.important ? 'font-medium text-accent-foreground' : ''}>
                  <strong className="block">{step.title}</strong>
                  <p className="text-foreground/80">{step.details}</p>
                </li>
              ))}
            </ol>

            {flow.relevantContacts && flow.relevantContacts.length > 0 && (
               <div className="mt-6">
                <h4 className="font-semibold mb-2 text-md">Relevant Contacts:</h4>
                <ul className="space-y-2 text-sm">
                  {flow.relevantContacts.map((contact, idx) => {
                    if (contact.name === "Your Veterinarian") {
                      return (
                        <li key="your-vet-card" className="p-3 border rounded-md bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                          <strong className="text-blue-800 dark:text-blue-300">Your Primary Veterinarian</strong>
                          <p className="text-foreground/80">Always try to contact your primary vet first during business hours.</p>
                        </li>
                      );
                    }
                    return (
                      <li key={idx} className="p-3 border rounded-md bg-secondary/50">
                        <strong>{contact.name}</strong>
                        {contact.number && <p>Phone: <a href={`tel:${contact.number}`} className="text-primary hover:underline">{contact.number}</a></p>}
                        {contact.website && <p>Website: <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">{contact.website} <ExternalLink className="ml-1 h-3 w-3"/></a></p>}
                      </li>
                    );
                  })}
                </ul>
               </div>
            )}
            
            <div className="mt-6 border-t pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchEmergencyContext(flow.name, flow.id)} 
                disabled={contextLoading[flow.id]}
                className="mb-2"
              >
                {contextLoading[flow.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {emergencyContexts[flow.id] ? 'Refresh' : 'Get'} Recent Community Advice
              </Button>
              {emergencyContexts[flow.id]?.redditAdvice && (
                <Card className="bg-accent/10 border-accent">
                  <CardHeader><CardTitle className="text-sm text-accent-foreground">Community Insights</CardTitle></CardHeader>
                  <CardContent><p className="text-xs text-accent-foreground/90 whitespace-pre-wrap">{emergencyContexts[flow.id]?.redditAdvice}</p></CardContent>
                </Card>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default EmergencyFlows;
