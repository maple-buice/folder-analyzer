import { TreeNode } from '../types'; // Adjust path as necessary

/**
 * Calculates the display path by removing the base folder path prefix.
 *
 * @param fullPath The full path of the file or folder.
 * @param folderPath The base folder path that was initially analyzed.
 * @returns The path relative to the initially analyzed folder.
 */
export const getDisplayPath = (fullPath: string, folderPath: string): string => {
  if (!folderPath) return fullPath;
  // Ensure the prefix ends with a separator for accurate slicing
  const prefix = folderPath.endsWith(require('path').sep)
    ? folderPath
    : folderPath + require('path').sep;
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
    // Directory node: recurse for children and sum their values
    const children = node.children.map((child) => toNivoTree(child, false)); // Recursive call
    const totalValue = children.reduce((acc: number, child: any) => acc + (child.value ?? 0), 0);
    const result: any = { id: node.id, name: node.name, children };
    // Assign the summed value to the parent, unless it's the root node
    // Nivo typically doesn't require a value on the absolute root if it has children
    if (!isRoot) {
      result.value = totalValue;
    }
    return result;
  }
  // Leaf node (file): return its basic info including size as value
  // Use a minimal value (e.g., 1) if size is missing or zero to ensure visibility
  return { id: node.id, name: node.name, value: node.size ?? 1 };
}
