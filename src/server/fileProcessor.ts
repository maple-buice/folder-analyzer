import fs from 'fs/promises'; // Use promises API
import path from 'path';
import { TreeNode } from '../types'; // Adjust path as necessary
import { calculateSize } from '../utils/tree'; // Assuming this path is correct as original

/**
 * Asynchronously processes files and directories within a given folder path
 * to build a tree structure representing the directory contents and their sizes.
 *
 * @param folderPath The absolute path to the folder to analyze.
 * @returns A Promise resolving to the TreeNode representing the root of the analyzed folder.
 */
export const processFilesAsync = async (folderPath: string): Promise<TreeNode> => {
  const fileMap: TreeNode[] = [];
  let files: string[] = [];

  try {
    files = await fs.readdir(folderPath);
  } catch (err: any) {
    // Improve error handling: check error code (e.g., EACCES, ENOENT)
    console.error(`Error reading directory ${folderPath}:`, err.message);
    // Re-throw or return a specific error structure if needed by the API
    throw new Error(`Failed to read directory ${folderPath}: ${err.message}`);
  }

  // Process files and directories concurrently
  await Promise.all(
    files.map(async (file) => {
      const fileName = typeof file === 'string' ? file : String(file);
      const filePath = path.join(folderPath, fileName);
      let stats;

      try {
        stats = await fs.stat(filePath); // Use async stat
      } catch (err: any) {
        // Handle potential errors accessing file stats (e.g., permissions)
        console.error(`Error getting stats for ${filePath}:`, err.message);
        // Skip this file/directory or handle appropriately
        return; // Continue with the next file
      }

      if (stats.isFile()) {
        fileMap.push({
          id: filePath,
          name: fileName,
          size: stats.size,
          key: filePath, // Nivo often uses id, key might be redundant if same as id
        });
      } else if (stats.isDirectory()) {
        // Directory: recurse asynchronously
        try {
          const childTree = await processFilesAsync(filePath); // Await recursive call
          // Ensure children array exists even if the subdirectory is empty or unreadable
          const children = childTree.children || [];
          // Only add directory if it contains children or if we want to represent empty dirs
          if (children.length > 0) {
            fileMap.push({
              id: filePath,
              name: fileName,
              children: children,
              size: 0, // Size will be calculated later
              key: filePath,
            });
          } else {
            // Optional: Represent empty directories if needed
            // fileMap.push({ id: filePath, name: fileName, children: [], size: 0, key: filePath });
            console.log(`Skipping empty or unreadable directory: ${filePath}`);
          }
        } catch (err: any) {
          console.error(`Error processing subdirectory ${filePath}:`, err.message);
          // Decide how to handle partially failed subdirectory processing
          // Option: Skip this subdirectory
        }
      }
      // Handle other file types (symlinks, etc.) if necessary
    })
  );

  // Use the full folderPath as the id/key for the root node
  const root: TreeNode = {
    id: folderPath,
    // Use basename for a cleaner root name, or keep 'root' if preferred
    name: path.basename(folderPath) || 'root',
    children: fileMap,
    size: 0, // Size will be calculated after processing children
    key: folderPath,
  };

  // Calculate sizes after the tree structure is built
  calculateSize(root);
  return root;
};
