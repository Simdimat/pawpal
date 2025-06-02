
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageCircle, Map, AlertTriangle, Hospital, Dog, XIcon, ChevronDown } from 'lucide-react';
import Image from 'next/image';

import ChatInterface from '@/components/chat/ChatInterface';
import PetMapDisplay from '@/components/map/PetMapDisplay';
import EmergencyFlows from '@/components/emergency/EmergencyFlows';
import VetListings from '@/components/vets/VetListings';
import ShelterListings from '@/components/shelters/ShelterListings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [isChatOpen, setIsChatOpen] = useState(true);

  return (
    <div className="flex flex-col gap-8">
      {/* Main Content Area */}
      <main className="w-full space-y-12">
        <section className="w-full py-12 md:py-20 lg:py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-xl shadow-lg">
          <div className="container px-4 md:px-6 text-center">
            <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
              Welcome to <span className="text-primary">PawPal SD</span>
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-foreground/80 md:text-xl">
              Your AI-powered companion for navigating pet life in San Diego. Find everything you need, from vets and parks to emergency advice, all in one place.
            </p>
          </div>
        </section>

        <section className="w-full">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-headline font-bold tracking-tight text-center text-foreground mb-12">
              Explore PawPal SD Features
            </h2>
            {/* Feature cards were previously removed here, keeping title as per user request */}
          </div>
        </section>

        {/* Consolidated Sections */}
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

      {/* Collapsible Chat Area */}
      {isChatOpen ? (
        <div className="fixed bottom-0 left-0 right-0 sm:bottom-4 sm:left-4 sm:right-4 z-[1010]">
          <Card className="w-full h-[45vh] sm:h-[50vh] max-h-[500px] shadow-xl flex flex-col overflow-hidden border border-border rounded-t-lg sm:rounded-lg">
            <CardHeader className="text-center border-b relative py-4">
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="w-6 h-6 text-primary" />
                <CardTitle className="text-lg font-headline text-primary">Ask PawPal AI</CardTitle>
              </div>
              <CardDescription className="text-foreground/80 text-xs mt-0.5">
                Your AI assistant for pet questions.
              </CardDescription>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 -translate-y-1/2 right-2 text-muted-foreground hover:text-foreground w-8 h-8"
                onClick={() => setIsChatOpen(false)}
                aria-label="Minimize chat"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
            </CardHeader>
            <ChatInterface />
          </Card>
        </div>
      ) : (
        <Button
          className="fixed bottom-4 right-4 z-50 rounded-full w-16 h-16 p-0 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center"
          onClick={() => setIsChatOpen(true)}
          aria-label="Open chat"
        >
          <MessageCircle className="w-8 h-8" />
        </Button>
      )}
    </div>
  );
}
