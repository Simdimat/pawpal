
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
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
        hostname: 's3-media0.fl.yelpcdn.com', // Added this line
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
};

export default nextConfig;
