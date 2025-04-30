import { TreeNode, NivoDataNode } from '../types'; // Adjust path as necessary
import path from 'path';

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
  const separator = path.sep;
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
export function toNivoTree(node: TreeNode): NivoDataNode {
  if (node.children && node.children.length > 0) {
    // Directory node: recurse for children
    const children = node.children.map((child) => toNivoTree(child));
    const result: NivoDataNode = { id: node.id, name: node.name, children };
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
export const calculateNivoTreeSize = (node: NivoDataNode | null): number => {
  if (!node) return 0;

  // If it's a leaf node (no children), return its value (or 0 if undefined)
  if (!node.children || node.children.length === 0) {
    return node.value ?? 0;
  }

  // If it's an internal node, recursively sum the sizes of its children
  return node.children.reduce((sum: number, child: NivoDataNode | null) => {
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
  node: NivoDataNode | null,
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
    node.children.forEach((child: NivoDataNode) => {
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
export const findNodeById = (node: NivoDataNode | null, targetId: string): NivoDataNode | null => {
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

/**
 * Recursively counts the total number of nodes (including self) in a Nivo tree.
 *
 * @param node The current NivoDataNode.
 * @returns The total count of nodes in the subtree starting at node.
 */
export const calculateNivoTreeNodeCount = (node: NivoDataNode | null): number => {
  if (!node) return 0;

  let count = 1; // Count the node itself

  if (node.children && node.children.length > 0) {
    count += node.children.reduce((sum: number, child: NivoDataNode) => {
      return sum + calculateNivoTreeNodeCount(child); // Recursively add counts from children
    }, 0);
  }

  return count;
};

/**
 * Recursively prunes a Nivo tree to a maximum depth.
 * Nodes deeper than maxDepth will not have their children included.
 * Creates copies of nodes to avoid mutating the original tree.
 *
 * @param node The current NivoDataNode.
 * @param maxDepth The maximum depth to keep (root is depth 0).
 * @param currentDepth The current depth during recursion.
 * @returns A pruned copy of the node, or null.
 */
function pruneRecursively(
  node: NivoDataNode | null,
  maxDepth: number,
  currentDepth: number
): NivoDataNode | null {
  if (!node) return null;

  // Create a shallow copy of the node
  const newNode: NivoDataNode = { ...node };

  // If we are beyond the max depth, clear children and return
  if (currentDepth >= maxDepth) {
    delete newNode.children; // Remove children array
    return newNode;
  }

  // If node has children and we are within depth limit, recurse
  if (newNode.children && newNode.children.length > 0) {
    newNode.children = newNode.children
      .map((child) => pruneRecursively(child, maxDepth, currentDepth + 1))
      .filter((child): child is NivoDataNode => child !== null); // Filter out null results and ensure correct type

    // If all children were pruned away deeper down, remove the children array
    if (newNode.children.length === 0) {
      delete newNode.children;
    }
  }

  return newNode;
}

/**
 * Prunes a Nivo-formatted tree to a specified maximum depth.
 *
 * @param rootNode The root NivoDataNode to prune.
 * @param maxDepth The maximum depth to retain (root is depth 0).
 * @returns A new tree pruned to the specified depth, or null if the input was null.
 */
export const pruneTreeDepth = (
  rootNode: NivoDataNode | null,
  maxDepth: number
): NivoDataNode | null => {
  if (!rootNode || maxDepth < 0) return rootNode; // Return original if null or invalid depth
  // Use structuredClone for a deep copy before pruning to be extra safe
  // regarding potential mutations if pruneRecursively had bugs (though it shouldn't)
  const clonedRoot = structuredClone(rootNode);
  return pruneRecursively(clonedRoot, maxDepth, 0); // Start recursion at depth 0
};

/**
 * Recursively calculates the number of nodes at each depth level.
 *
 * @param node The current NivoDataNode.
 * @param depthCounts An array where index = depth, value = count. Modified in place.
 * @param currentDepth The current depth during recursion.
 */
function countNodesAtDepthRecursive(
  node: NivoDataNode | null,
  depthCounts: number[],
  currentDepth: number
): void {
  if (!node) return;

  // Ensure array is long enough
  while (depthCounts.length <= currentDepth) {
    depthCounts.push(0);
  }
  depthCounts[currentDepth]++; // Increment count at current depth

  // Recurse for children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      countNodesAtDepthRecursive(child, depthCounts, currentDepth + 1);
    }
  }
}

/**
 * Calculates the number of nodes at each depth level for a Nivo tree.
 *
 * @param rootNode The root NivoDataNode.
 * @returns An array where the index represents the depth (starting from 0 for the root)
 *          and the value is the number of nodes at that depth.
 */
export const calculateNodesPerDepth = (rootNode: NivoDataNode | null): number[] => {
  const depthCounts: number[] = [];
  countNodesAtDepthRecursive(rootNode, depthCounts, 0);
  return depthCounts;
};

/**
 * Calculates the appropriate display depth for a Nivo tree based on node count.
 * If the total node count exceeds the threshold, it determines the maximum depth
 * that keeps the cumulative node count at or below the threshold.
 *
 * @param rootNode The root NivoDataNode.
 * @param nodeCountThreshold The maximum allowed cumulative nodes before pruning.
 * @param minPruneDepth The shallowest depth pruning is allowed to go (e.g., 3).
 * @param fullDepth The depth value representing 'no pruning' (e.g., 1000).
 * @returns The calculated depth (either fullDepth or a pruned depth >= minPruneDepth).
 */
export const calculateDynamicDepth = (
  rootNode: NivoDataNode | null,
  nodeCountThreshold: number,
  minPruneDepth: number,
  fullDepth: number
): number => {
  if (!rootNode) return fullDepth; // Default if no data

  const totalNodeCount = calculateNivoTreeNodeCount(rootNode);
  // console.log(`(Util) Current view total node count: ${totalNodeCount}`); // Keep log for now

  // If total count is already below threshold, show full depth
  if (totalNodeCount <= nodeCountThreshold) {
    // console.log(`(Util) Node count <= threshold, using full depth: ${fullDepth}`);
    return fullDepth;
  }

  // If count exceeds threshold, calculate nodes per depth
  const nodesPerDepth = calculateNodesPerDepth(rootNode);
  let cumulativeCount = 0;
  let calculatedDepth = 0;

  for (let depth = 0; depth < nodesPerDepth.length; depth++) {
    cumulativeCount += nodesPerDepth[depth];
    if (cumulativeCount <= nodeCountThreshold) {
      calculatedDepth = depth;
    } else {
      // Stop as soon as cumulative count exceeds threshold
      break;
    }
  }

  // Ensure we don't prune too aggressively
  const finalDepth = Math.max(minPruneDepth, calculatedDepth);
  // console.log(
  //   `(Util) Node count > threshold. Calculated depth: ${calculatedDepth}, Final prune depth: ${finalDepth}`
  // );
  return finalDepth;
};
