import { TreeNode } from '../types'; // Adjust path as necessary

/**
 * Calculates the display path by removing the base folder path prefix.
 * Assumes execution in an environment with Node.js 'path' module available (e.g., Electron main/renderer with nodeIntegration).
 *
 * @param fullPath The full path of the file or folder.
 * @param folderPath The base folder path that was initially analyzed.
 * @returns The path relative to the initially analyzed folder.
 */
export const getDisplayPath = (fullPath: string, folderPath: string): string => {
  if (!folderPath) return fullPath;
  // NOTE: Relies on require('path').sep - ensure environment compatibility.
  const separator = require('path').sep;
  const prefix = folderPath.endsWith(separator) ? folderPath : folderPath + separator;
  // Check if the fullPath actually starts with the prefix before slicing
  return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath;
};

/**
 * Recursively extracts all unique file extensions from a TreeNode structure.
 *
 * @param node The root TreeNode to start searching from.
 * @param extensions A Set to store the found extensions (used internally for recursion).
 * @returns A Set containing all unique lowercase file extensions found in the tree.
 */
export const getExtensionsFromTree = (
  node: TreeNode | null,
  extensions = new Set<string>()
): Set<string> => {
  if (!node) return extensions;

  if (node.children && node.children.length > 0) {
    // If it's a directory, recurse into children
    node.children.forEach((child) => getExtensionsFromTree(child, extensions));
  } else if (node.name && node.name.includes('.')) {
    // If it's potentially a file with an extension
    const lastDotIndex = node.name.lastIndexOf('.');
    // Ensure the dot is not the first character (e.g., hidden files like .env)
    if (lastDotIndex > 0) {
      const ext = node.name.slice(lastDotIndex).toLowerCase();
      extensions.add(ext);
    }
  }
  return extensions;
};

/**
 * Converts the custom TreeNode structure into the format expected by Nivo Sunburst.
 * It recursively processes nodes and sums up child values for parent nodes.
 *
 * @param node The TreeNode to convert.
 * @param isRoot Flag indicating if the current node is the root of the entire tree.
 * @returns An object formatted for Nivo Sunburst (id, name, value, children?).
 */
export function toNivoTree(node: TreeNode, isRoot = false): any {
  if (node.children && node.children.length > 0) {
    // Directory node: recurse for children
    const children = node.children.map((child) => toNivoTree(child, false));
    const result: any = { id: node.id, name: node.name, children };
    return result;
  }
  // Leaf node (file): return its basic info including size as value
  // Use a minimal value (e.g., 1) if size is missing or zero to ensure visibility
  return { id: node.id, name: node.name, value: node.size || 1 };
}

/**
 * Recursively calculates the total size represented by a Nivo-formatted tree node
 * by summing the 'value' of all leaf nodes within it.
 *
 * @param node The Nivo-formatted node (can have id, name, value, children).
 * @returns The total size (sum of leaf values).
 */
export const calculateNivoTreeSize = (node: any): number => {
  if (!node) return 0;

  // If it's a leaf node (no children), return its value (or 0 if undefined)
  if (!node.children || node.children.length === 0) {
    return node.value ?? 0;
  }

  // If it's an internal node, recursively sum the sizes of its children
  return node.children.reduce((sum: number, child: any) => {
    return sum + calculateNivoTreeSize(child);
  }, 0);
};

/**
 * Recursively calculates the total size for each file extension within a Nivo tree.
 *
 * @param node The Nivo-formatted node to analyze.
 * @param breakdown An object to accumulate sizes (used internally for recursion).
 * @returns A record mapping file extensions (e.g., '.js') to their total size in bytes.
 */
export const calculateExtensionNivoSizes = (
  node: any,
  // Initialize with an empty object for the top-level call
  breakdown: Record<string, number> = {}
): Record<string, number> => {
  if (!node) return breakdown;

  // Leaf node: check for extension and add its value
  if (!node.children || node.children.length === 0) {
    if (node.name && node.name.includes('.')) {
      const lastDotIndex = node.name.lastIndexOf('.');
      if (lastDotIndex > 0) {
        // Ensure dot isn't the first char
        const ext = node.name.slice(lastDotIndex).toLowerCase();
        const size = node.value ?? 0;
        breakdown[ext] = (breakdown[ext] || 0) + size;
      }
    }
  } else {
    // Internal node: recurse through children
    node.children.forEach((child: any) => {
      calculateExtensionNivoSizes(child, breakdown); // Pass the same breakdown object down
    });
  }

  return breakdown;
};

/**
 * Recursively searches a Nivo-formatted tree for a node with a specific ID.
 *
 * @param node The current node to examine.
 * @param targetId The ID of the node to find.
 * @returns The node object if found, otherwise null.
 */
export const findNodeById = (node: any, targetId: string): any | null => {
  if (!node) return null;
  if (node.id === targetId) {
    return node;
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) {
        return found;
      }
    }
  }

  return null;
};
