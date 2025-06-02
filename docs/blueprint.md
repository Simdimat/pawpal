# **App Name**: PawPal SD

## Core Features:

- Ask PawPal: AI-powered chat assistant using OpenAI's API to answer pet-related questions specific to San Diego. Integrates context from Yelp, Reddit, and Petfinder using a tool to decide if context should be incorporated in its output.
- Pet Map SD: Interactive map displaying dog-friendly locations (beaches, parks, vets) sourced from OpenStreetMap, Yelp, Petfinder, and USDA. Allows filtering and location search.
- Dog Day Out Matcher: Listing of local shelters offering dog day out and volunteer walking programs, fetched from Petfinder API.
- Emergency Flow Tool: Step-by-step guide for common pet emergencies (skunk spray, found stray, etc.) using static JSON data, augmented with context from Reddit API using AI tool.
- Vet Information Hub: Display San Diego vet listings from Yelp and allows browsing Tijuana vet information and user reviews. Connects user with Reddit data about TJ vet reviews.
- Weather Integration: Displays current San Diego weather to aid in planning pet activities.
- Email Persistence: Email persistence for saving chat history and preferences, using local storage and Supabase. Prompts the user for feedback on the AI's helpfulness after the second AI response.

## Style Guidelines:

- Primary color: Soft blue (#64B5F6) to convey trustworthiness and reliability. The choice of hue relates to a sense of safety and companionship that users need to feel when making choices for their pet.
- Background color: Light gray (#F0F4F8) for main content areas to provide contrast. The choice of a pale neutral provides a sense of cleanliness, and lets the user's attention stay on the data and content.
- Accent color: Warm orange (#FFAB40) to highlight interactive elements, calls to action, and alerts. As an analogous color, orange conveys energy and positive association with activities with the pet.
- Body and headline font: 'PT Sans' (sans-serif) for clear and accessible readability.
- Use Font Awesome or similar SVG icons for pets, locations, actions, and weather.
- Mobile-first, responsive design.
- Subtle fade-ins for content and loading spinners for data fetching.