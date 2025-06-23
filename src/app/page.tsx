
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageSquare, Map, AlertTriangle, Hospital, Dog, XIcon, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import Image from 'next/image';

import ChatInterface from '@/components/chat/ChatInterface';
import PetMapDisplay from '@/components/map/PetMapDisplay';
import EmergencyFlows from '@/components/emergency/EmergencyFlows';
import VetListings from '@/components/vets/VetListings';
import ShelterListings from '@/components/shelters/ShelterListings';
import FeatureRequests from '@/components/features/FeatureRequests';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Define header height (approximate, adjust if needed)
  const headerHeight = "4.5rem"; // Adjusted for better clearance

  return (
    <div className="flex flex-col md:flex-row w-full gap-x-6 relative"> {/* Added relative positioning */}
      {/* Left Column - Main Content */}
      {/* Added pt-8 here for top spacing, consistent with original py-8 */}
      <div className="w-full md:w-3/4 pt-8">
        {/* Main content will naturally scroll if taller than viewport */}
        <main className="w-full space-y-12">
          <section className="w-full py-12 text-center">
            <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl md:text-6xl">
              <span className="text-foreground">Welcome to</span>{' '}
              <span className="text-primary">PawPal SD</span>
            </h1>
            <p className="mt-4 max-w-3xl mx-auto text-lg text-foreground/80 md:text-xl">
              This site is your all-in-one resource for pet life in San Diego! Use the interactive <a href="#map-section" className="text-primary hover:underline font-semibold">Pet Map</a> to find parks and vets, consult the <a href="#emergency-section" className="text-primary hover:underline font-semibold">Emergency Guide</a> for urgent situations, or ask our <a href="#" onClick={() => setIsChatOpen(true)} className="text-primary hover:underline font-semibold">AI Assistant</a> for quick answers. Your feedback shapes our development, so please share your ideas below!
            </p>
          </section>

          <FeatureRequests />

          <section className="w-full">
            <div className="container px-0">
              <h2 className="text-3xl font-headline font-bold tracking-tight text-center text-foreground mb-12">
                Explore PawPal SD Features
              </h2>
            </div>
          </section>

          <section id="map-section" className="scroll-m-20 py-8">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-headline text-primary">Pet Map SD</CardTitle>
                <CardDescription className="text-foreground/80">
                  Discover dog-friendly parks, beaches, vets, and restaurants in San Diego.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PetMapDisplay />
              </CardContent>
            </Card>
          </section>

          <section id="emergency-section" className="scroll-m-20 py-8">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-headline text-primary">Pet Emergency Guide</CardTitle>
                <CardDescription className="text-foreground/80">
                  Quick access to step-by-step guidance for common pet emergencies.
                  This information is not a substitute for professional veterinary advice.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmergencyFlows />
              </CardContent>
            </Card>
          </section>

          <section id="vets-section" className="scroll-m-20 py-8">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-headline text-primary">Veterinarian Information Hub</CardTitle>
                <CardDescription className="text-foreground/80">
                  Find veterinarians in San Diego and explore community insights about vet services in Tijuana.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="sd_vets" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="sd_vets">San Diego Vets</TabsTrigger>
                    <TabsTrigger value="tj_vets">Tijuana Vets Info</TabsTrigger>
                  </TabsList>
                  <TabsContent value="sd_vets">
                    <VetListings locationType="SD" />
                  </TabsContent>
                  <TabsContent value="tj_vets">
                    <VetListings locationType="TJ" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          <section id="dog-day-out-section" className="scroll-m-20 py-8">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-headline text-primary">Dog Day Out & Volunteer</CardTitle>
                <CardDescription className="text-foreground/80">
                  Find local shelters offering "Dog Day Out" programs or volunteer dog walking opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShelterListings />
              </CardContent>
            </Card>
          </section>
        </main>
      </div>

      {/* Right Column - Chatbot */}
      <div
        className="w-full md:w-1/4 md:sticky self-start flex flex-col"
        style={{ top: headerHeight, height: `calc(100vh - ${headerHeight})` }}
      >
        {isChatOpen ? (
          <Card className="w-full flex-1 flex flex-col shadow-xl border border-border rounded-lg overflow-hidden min-h-0">
            <CardHeader className="text-center border-b relative py-3 shrink-0">
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <CardTitle className="text-md font-headline text-primary">Ask PawPal AI</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 -translate-y-1/2 right-1 text-muted-foreground hover:text-foreground w-7 h-7"
                onClick={() => setIsChatOpen(false)}
                aria-label="Minimize chat"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 p-0">
              <ChatInterface />
            </CardContent>
          </Card>
        ) : (
          <div className="w-full flex md:justify-start justify-center items-start pt-0">
            <Button
              className="rounded-lg w-auto shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 py-2 px-3 text-sm"
              onClick={() => setIsChatOpen(true)}
              aria-label="Open chat"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Ask PawPal</span>
              <ChevronUp className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
