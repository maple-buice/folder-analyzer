import { serve } from 'bun';
import index from './index.html';

// Import the refactored API handler
import { handleAnalyzeFolder } from './server/api';

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    '/*': index,

    // Use the imported handler for the API route
    '/api/analyze-folder/:path': handleAnalyzeFolder,
  },
  development: process.env.NODE_ENV !== 'production',
});

console.log(`🚀 Folder Sunburst Explorer server running at ${server.url}`);
