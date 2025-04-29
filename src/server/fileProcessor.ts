import fs from 'fs/promises'; // Use promises API
import path from 'path';
import { TreeNode } from '../types';
import { calculateSize } from '../utils/tree';

/**
 * Asynchronously processes files and directories within a given folder path
 * to build a tree structure representing the directory contents and their sizes.
 * Also collects any access errors encountered during processing.
 *
 * @param folderPath The absolute path to the folder to analyze.
 * @returns A Promise resolving to an object containing the `node` (TreeNode root) and an `errors` array (string messages).
 */
export const processFilesAsync = async (
  folderPath: string
): Promise<{ node: TreeNode; errors: string[] }> => {
  const fileMap: TreeNode[] = [];
  let files: string[] = [];
  const errors: string[] = [];

  try {
    files = await fs.readdir(folderPath);
  } catch (err: any) {
    const errorMessage = `Error reading directory ${folderPath}: ${err.message}`;
    console.error(errorMessage);
    errors.push(errorMessage); // Add error to the list
    // Cannot proceed further in this directory, return empty node structure with error
    const root: TreeNode = {
      id: folderPath,
      name: path.basename(folderPath) || 'root',
      children: [],
      size: 0,
      key: folderPath,
    };
    return { node: root, errors };
    // Alternatively, re-throw if the API handler should treat this as a fatal error for the whole request
  }

  // Process files and directories concurrently
  await Promise.all(
    files.map(async (file) => {
      const fileName = typeof file === 'string' ? file : String(file);
      const filePath = path.join(folderPath, fileName);
      let stats;

      try {
        // Use lstat instead of stat to avoid following symlinks into potential loops
        stats = await fs.lstat(filePath);
      } catch (err: any) {
        const errorMessage = `Cannot access: ${filePath}: ${err.message}`;
        console.error(errorMessage);
        errors.push(errorMessage);
        return; // Continue with the next file
      }

      if (stats.isFile()) {
        fileMap.push({
          id: filePath,
          name: fileName,
          size: stats.size,
          key: filePath,
        });
      } else if (stats.isDirectory()) {
        // Directory: recurse asynchronously
        try {
          const childResult = await processFilesAsync(filePath);
          errors.push(...childResult.errors);

          const childTree = childResult.node;
          const children = childTree.children || [];

          if (children.length > 0) {
            fileMap.push({
              id: filePath,
              name: fileName,
              children: children,
              size: 0,
              key: filePath,
            });
          } else {
            // Decide if we want to log/report empty directories that were successfully read
          }
        } catch (err: any) {
          // This catch might be less likely...
          const errorMessage = `Error processing subdirectory ${filePath}: ${err.message}`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      } else if (stats.isSymbolicLink()) {
        // Optional: Handle symbolic links specifically if needed
        console.log(`Skipping symbolic link: ${filePath}`);
        // Optionally report skipped links
      }
      // Handle other file types (sockets, block devices etc.) if necessary
    })
  );

  const root: TreeNode = {
    id: folderPath,
    name: path.basename(folderPath) || 'root',
    children: fileMap,
    size: 0,
    key: folderPath,
  };

  calculateSize(root);
  // Return both the node and the collected errors
  return { node: root, errors };
};
