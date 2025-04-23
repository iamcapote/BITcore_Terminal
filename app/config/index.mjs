import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config = {
  venice: {
    // Use a specific public key env var, or fallback if needed
    apiKey: process.env.VENICE_PUBLIC_API_KEY || process.env.VENICE_API_KEY,
    // Add other Venice-related configs if needed
  },
  brave: {
    apiKey: process.env.BRAVE_API_KEY,
    // Add other Brave-related configs if needed
  },
  github: {
    // Add GitHub related configs if needed (e.g., default repo, path)
    // Note: User-specific tokens are handled by userManager
  },
  server: {
    port: process.env.PORT || 3000,
    websocketPath: '/api/research/ws',
  },
  // Add other configuration sections as needed
};

export default config;
