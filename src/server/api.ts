import fs from 'fs/promises';
import { processDirectory } from './fileProcessor';
import { ApiResponse } from '../types';

/**
 * Handles the logic for the /api/analyze-folder endpoint.
 * Assumes routing/param extraction is done by the caller (e.g., Bun.serve routes).
 */
export const handleAnalyzeFolder = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const headers = { 'Content-Type': 'application/json' };

  // Extract path from the request URL (assuming it matches the route pattern)
  const pathParts = url.pathname.split('/api/analyze-folder/');
  const encodedPath = pathParts[1] || '';
  if (!encodedPath) {
    return new Response(
      JSON.stringify({
        message: 'Folder path parameter is missing',
        tree: null,
      } satisfies ApiResponse),
      { status: 400, headers }
    );
  }
  const folderPath = decodeURIComponent(encodedPath);

  // --- Exclusions ---
  const excludeQuery = url.searchParams.get('exclude') || '';
  const exclusions = excludeQuery
    ? excludeQuery
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  console.log(
    `API Handler: Analyzing folder: ${folderPath}, Excluding: ${exclusions.join(', ') || 'None'}`
  );

  try {
    // --- Path Validation ---
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return new Response(
        JSON.stringify({ message: 'Path is not a directory', tree: null } satisfies ApiResponse),
        { status: 400, headers }
      );
    }

    // --- Processing ---
    // Use processDirectory which returns { node, errors, size }
    const { node: treeNode, errors: processErrors } = await processDirectory(
      folderPath,
      exclusions
    );

    const responsePayload: ApiResponse = {
      message: 'Analysis successful',
      tree: treeNode, // Use the node from the result
      errors: processErrors, // Use the errors from the result
    };
    return new Response(JSON.stringify(responsePayload), { status: 200, headers });
  } catch (err: unknown) {
    // --- Error Handling ---
    let status = 500;
    let message = 'An unknown error occurred during analysis.'; // Default message
    const errorResponsePayload: ApiResponse = { message: '', tree: null, errors: [] };

    // Helper to check if err is an object with a 'code' property
    const hasCode = (
      e: unknown
    ): e is { code: string; message?: string } & Record<string, unknown> => {
      return typeof e === 'object' && e !== null && 'code' in e;
    };

    if (err instanceof Error) {
      message = `Error analyzing folder: ${err.message}`;
    }

    // Check for specific error codes if err is an object with a code property
    if (hasCode(err)) {
      if (err.code === 'ENOENT') {
        status = 404;
        message = 'Folder does not exist';
      } else if (err.code === 'EACCES') {
        status = 403;
        message = `Permission denied accessing folder: ${folderPath}`;
      } else if (message === 'An unknown error occurred during analysis.') {
        // If it has a code but wasn't handled above, try to include it
        message = `Analysis error (code: ${err.code}): ${err.message || 'Unknown error'}`;
      }
    }

    console.error(`API Handler Error processing ${folderPath}:`, err);

    errorResponsePayload.message = message;
    errorResponsePayload.errors = [message]; // Include the primary error message

    return new Response(JSON.stringify(errorResponsePayload), { status, headers });
  }
};

// Remove Bun.serve and export { fetchHandler } from here
