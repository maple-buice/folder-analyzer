import fsPromises from 'fs/promises'; // Use promises API
import fs from 'fs'; // Import standard fs for types
import path from 'path';
import { TreeNode } from '../types';

/**
 * Asynchronously processes files and directories within a given folder path
 * to build a tree structure representing the directory contents and their sizes.
 * Also collects any access errors encountered during processing.
 *
 * @param folderPath The absolute path to the folder to analyze.
 * @param excludedFolders An array of folder names (case-sensitive) to skip.
 * @returns A Promise resolving to an object containing the `node` (TreeNode root), an `errors` array, and the calculated `size`.
 */
export const processFilesAsync = async (
  folderPath: string,
  excludedFolders: string[] = []
): Promise<{ node: TreeNode; errors: string[]; size: number }> => {
  const errors: string[] = [];
  let dirents: fs.Dirent[] = [];

  try {
    dirents = await fsPromises.readdir(folderPath, { withFileTypes: true });
  } catch (err: any) {
    const errorMessage = `Error reading directory ${folderPath}: ${err.message || err}`;
    console.error(errorMessage);
    errors.push(errorMessage);
    const root: TreeNode = {
      id: folderPath,
      name: path.basename(folderPath) || 'root',
      children: [],
      size: 0,
      key: folderPath,
    };
    return { node: root, errors, size: 0 };
  }

  const direntsToProcess = dirents.filter((dirent) => !excludedFolders.includes(dirent.name));

  const processingPromises = direntsToProcess.map(
    async (
      dirent: fs.Dirent
    ): Promise<{ nodeData: TreeNode | null; size: number; error?: string }> => {
      const filePath = path.join(folderPath, dirent.name);
      let stats: fs.Stats;

      try {
        stats = await fsPromises.lstat(filePath); // Use lstat from fsPromises

        if (stats.isFile()) {
          return {
            nodeData: { id: filePath, name: dirent.name, size: stats.size, key: filePath },
            size: stats.size,
          };
        } else if (stats.isDirectory()) {
          const childResult = await processFilesAsync(filePath, excludedFolders);
          errors.push(...childResult.errors); // Aggregate errors immediately
          return {
            nodeData: {
              id: filePath,
              name: dirent.name,
              children: childResult.node.children || [],
              size: childResult.size,
              key: filePath,
              // processingErrors: childResult.errors.length > 0 ? childResult.errors : undefined,
            },
            size: childResult.size,
          };
        } else if (stats.isSymbolicLink()) {
          console.log(`Skipping symbolic link: ${filePath}`);
          return { nodeData: null, size: 0 };
        } else {
          console.log(`Skipping unknown type: ${filePath}`);
          return { nodeData: null, size: 0 };
        }
      } catch (err: any) {
        const errorMessage = `Cannot access: ${filePath}: ${err.message || err}`;
        console.error(errorMessage);
        return { nodeData: null, size: 0, error: errorMessage };
      }
    }
  );

  const results = await Promise.all(processingPromises);

  const childrenNodes: TreeNode[] = [];
  let calculatedTotalSize = 0;
  results.forEach((result) => {
    if (result.nodeData) {
      childrenNodes.push(result.nodeData);
    }
    calculatedTotalSize += result.size;
    if (result.error) {
      errors.push(result.error);
    }
  });

  const root: TreeNode = {
    id: folderPath,
    name: path.basename(folderPath) || 'root',
    children: childrenNodes,
    size: calculatedTotalSize,
    key: folderPath,
    processingErrors: errors.length > 0 ? [...new Set(errors)] : undefined, // Add unique errors to node
  };

  return { node: root, errors: [...new Set(errors)], size: calculatedTotalSize }; // Return unique errors
};

/**
 * Wrapper function for compatibility or semantic clarity.
 * @returns A promise that resolves to the structure containing the TreeNode, errors, and size.
 */
export async function processDirectory(
  folderPath: string,
  excludedFolders: string[] = []
): Promise<{ node: TreeNode; errors: string[]; size: number }> {
  return processFilesAsync(folderPath, excludedFolders);
}
