
import type {NextConfig} from 'next';
import path from 'path'; // Import the 'path' module

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
      // Make the alias more explicit using path.resolve
      'mapbox-gl': path.resolve(__dirname, 'node_modules/maplibre-gl'),
    };
    console.log("Webpack config modified with mapbox-gl alias to maplibre-gl (path resolved)."); // For server-side logging confirmation
    return config;
  },
};

export default nextConfig;
