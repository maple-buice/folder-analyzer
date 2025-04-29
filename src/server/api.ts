import fs from 'fs/promises'; // Use promises API for exists/stat check
import { ApiResponse } from '../types'; // Adjust path as necessary
import { processFilesAsync } from './fileProcessor'; // Import the async processor

/**
 * API route handler for analyzing a folder.
 * Validates the path and calls the asynchronous file processor.
 */
export const handleAnalyzeFolder = async (req: { params: { path: string } }): Promise<Response> => {
  // Bun automatically decodes the path parameter
  const folderPath = req.params.path;
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
    // Capture the result object containing the node and any errors
    const { node: tree, errors: processErrors } = await processFilesAsync(folderPath);

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
