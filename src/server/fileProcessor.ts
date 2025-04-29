import fs from 'fs/promises'; // Use promises API
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
  excludedFolders: string[] = [] // Added parameter with default
): Promise<{ node: TreeNode; errors: string[]; size: number }> => {
  const fileMap: TreeNode[] = [];
  let files: string[] = [];
  const errors: string[] = [];
  let totalSize = 0; // Initialize total size for this directory

  try {
    files = await fs.readdir(folderPath);
  } catch (err: any) {
    const errorMessage = `Error reading directory ${folderPath}: ${err.message}`;
    console.error(errorMessage);
    errors.push(errorMessage);
    const root: TreeNode = {
      id: folderPath,
      name: path.basename(folderPath) || 'root',
      children: [],
      size: 0, // Return 0 size for unreadable directory
      key: folderPath,
    };
    return { node: root, errors, size: 0 }; // Return 0 size
  }

  // Filter out excluded folder names *before* processing
  const filesToProcess = files.filter((file) => !excludedFolders.includes(file));

  await Promise.all(
    filesToProcess.map(async (file) => {
      const fileName = typeof file === 'string' ? file : String(file);
      const filePath = path.join(folderPath, fileName);
      let stats;

      try {
        stats = await fs.lstat(filePath);
      } catch (err: any) {
        const errorMessage = `Cannot access: ${filePath}: ${err.message}`;
        console.error(errorMessage);
        errors.push(errorMessage);
        return; // Skip this file/dir, size remains 0 for it
      }

      if (stats.isFile()) {
        const fileSize = stats.size;
        totalSize += fileSize; // Add file size to total
        fileMap.push({
          id: filePath,
          name: fileName,
          size: fileSize,
          key: filePath,
        });
      } else if (stats.isDirectory()) {
        try {
          // Await recursive call and capture its result
          const childResult = await processFilesAsync(filePath, excludedFolders);
          errors.push(...childResult.errors); // Aggregate errors
          totalSize += childResult.size; // Add subdirectory size to total

          const childTree = childResult.node;
          // Only add non-empty directories to the map to avoid clutter?
          // Or use childResult.size > 0 ?
          // Let's keep empty ones for now, consistent with original logic
          fileMap.push({
            id: filePath,
            name: fileName,
            children: childTree.children || [],
            size: childResult.size, // Assign calculated size directly
            key: filePath,
          });
        } catch (err: any) {
          const errorMessage = `Error processing subdirectory ${filePath}: ${err.message}`;
          console.error(errorMessage);
          errors.push(errorMessage);
          // Exclude this directory from size calculation if recursion failed
        }
      } else if (stats.isSymbolicLink()) {
        console.log(`Skipping symbolic link: ${filePath}`);
        // Links are not added to fileMap and don't contribute size
      }
    })
  );

  const root: TreeNode = {
    id: folderPath,
    name: path.basename(folderPath) || 'root',
    children: fileMap,
    size: totalSize, // Assign the calculated total size
    key: folderPath,
  };

  return { node: root, errors, size: totalSize }; // Return calculated size
};
