import fs from 'fs/promises'; // Use promises API for exists/stat check
import { ApiResponse } from '../types'; // Adjust path as necessary
import { processFilesAsync } from './fileProcessor'; // Import the async processor
import { URLSearchParams } from 'url'; // Needed for parsing query params

/**
 * API route handler for analyzing a folder.
 * Validates the path and calls the asynchronous file processor.
 * Accepts an 'exclude' query parameter with comma-separated folder names.
 */
export const handleAnalyzeFolder = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  // Extract path param - assumes format /api/analyze-folder/:path
  // This part might need adjustment based on Bun's exact routing/param handling.
  // Let's assume the path is the last part after '/api/analyze-folder/'
  const pathParts = url.pathname.split('/api/analyze-folder/');
  const encodedPath = pathParts[1] || ''; // Get the part after the prefix
  const folderPath = decodeURIComponent(encodedPath); // Decode the path

  const queryParams = new URLSearchParams(url.search);
  const excludeQuery = queryParams.get('exclude') || '';
  const excludedFolders = excludeQuery
    ? excludeQuery
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : [];

  console.log(`Analyzing folder: ${folderPath}, Excluding: ${excludedFolders.join(', ')}`); // Log exclusions

  try {
    // Check if path exists and is a directory using async stat
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return Response.json(
        { message: 'Path is not a directory', tree: null } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Path is valid, proceed with asynchronous analysis
    // Pass excludedFolders to the processor
    const { node: tree, errors: processErrors } = await processFilesAsync(
      folderPath,
      excludedFolders
    );

    // Return the tree and include any errors encountered during processing
    return Response.json({
      message: 'Folder analysis complete',
      tree,
      errors: processErrors,
    } satisfies ApiResponse);
  } catch (err: any) {
    // Handle errors from fs.stat (e.g., path doesn't exist) or fatal errors from processFilesAsync
    if (err.code === 'ENOENT') {
      return Response.json({ message: 'Folder does not exist', tree: null } satisfies ApiResponse, {
        status: 404,
      });
    }
    // Handle permission errors from fs.stat
    if (err.code === 'EACCES') {
      return Response.json(
        {
          message: `Permission denied accessing folder: ${folderPath}`,
          tree: null,
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // Catch other errors
    console.error(`Error analyzing folder ${folderPath}:`, err);
    return Response.json(
      {
        message: `Error analyzing folder: ${err.message || 'Unknown error'}`,
        tree: null, // Explicitly null tree on general error
        // errors: [err.message || 'Unknown error'] // Optionally include the fatal error message here too
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
};
