
import type {NextConfig} from 'next';
import path from 'path'; // Import the 'path' module

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    'https://3001-firebase-studio-1749788380874.cluster-t23zgfo255e32uuvburngnfnn4.cloudworkstations.dev',
    'https://3002-firebase-studio-1749788380874.cluster-t23zgfo255e32uuvburngnfnn4.cloudworkstations.dev'
    ,'https://3003-firebase-studio-1749788380874.cluster-t23zgfo255e32uuvburngnfnn4.cloudworkstations.dev',
    'https://3004-firebase-studio-1749788380874.cluster-t23zgfo255e32uuvburngnfnn4.cloudworkstations.dev',
    'https://3005-firebase-studio-1749788380874.cluster-t23zgfo255e32uuvburngnfnn4.cloudworkstations.dev'
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      { // For Yelp images
        protocol: 'https',
        hostname: 's3-media0.fl.yelpcdn.com',
      },
      {
        protocol: 'https',
        hostname: 's3-media1.fl.yelpcdn.com',
      },
      {
        protocol: 'https',
        hostname: 's3-media2.fl.yelpcdn.com',
      },
      {
        protocol: 'https',
        hostname: 's3-media3.fl.yelpcdn.com',
      },
      {
        protocol: 'https',
        hostname: 's3-media4.fl.yelpcdn.com',
      },
      { // For Petfinder images
        protocol: 'https',
        hostname: 'dl5zpyw5k3jtl.cloudfront.net',
      },
      { // Another Petfinder image hostname
        protocol: 'https',
        hostname: 'dl5zpyw5k3jeb.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: 'photos.petfinder.com',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    // Aliasing mapbox-gl to maplibre-gl
    config.resolve.alias = {
      ...config.resolve.alias,
      // Use the direct module name for the alias
      'mapbox-gl': 'maplibre-gl',
    };
    console.log("Webpack config modified with mapbox-gl alias to 'maplibre-gl'.");
    return config;
  },
};

export default nextConfig;
