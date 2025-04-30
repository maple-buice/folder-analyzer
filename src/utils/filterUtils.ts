import { NivoDataNode } from '@/types';

/**
 * Recursively filters a Nivo-formatted tree based on search text and extension.
 * Keeps nodes that match the criteria or have children that match.
 *
 * @param node The current node in the Nivo data structure to evaluate.
 * @param search The search string (case-insensitive).
 * @param ext The file extension filter (case-insensitive, expects format like '.js').
 * @param isRoot Flag indicating if the current node is the root of the tree being filtered.
 * @param parentMatchedText Internal flag indicating if the parent node already matched the text filter.
 * @returns The filtered node (or null if the node and its descendants don't match).
 */
export function filterTree(
  node: NivoDataNode | null,
  search: string,
  ext: string,
  parentMatchedText = false
): NivoDataNode | null {
  if (!node) return null;

  // Prepare filter criteria (lowercase)
  const searchLower = search ? search.toLowerCase() : '';
  const extLower = ext ? (ext.startsWith('.') ? ext.toLowerCase() : '.' + ext.toLowerCase()) : '';

  // Determine if the current node itself matches the filters individually
  const matchesText =
    !searchLower ||
    node.name.toLowerCase().includes(searchLower) ||
    node.id.toLowerCase().includes(searchLower);
  // Extension match logic depends on whether it's a file or if parent forced inclusion via text match
  const matchesExt =
    !extLower || (node.children ? parentMatchedText : node.name.toLowerCase().endsWith(extLower));

  // --- Internal Node (Directory) --- //
  if (node.children && node.children.length > 0) {
    // If this parent node matches an *active* text filter, its children should ignore the text filter (pass down true)
    const passDownParentMatchedText = parentMatchedText || (matchesText && !!searchLower);

    // Recursively filter children
    const filteredChildren: NivoDataNode[] = node.children
      .map((child: NivoDataNode) => filterTree(child, search, ext, passDownParentMatchedText)) // Pass flag down
      .filter(Boolean) as NivoDataNode[]; // Remove null results (children that didn't match)

    // Keep this internal node if:
    // 1. It has children that passed the filter OR
    // 2. It matches an ACTIVE text filter (searchLower is not empty)
    const keepInternal = filteredChildren.length > 0 || (matchesText && !!searchLower);

    if (keepInternal) {
      const result: NivoDataNode = { ...node, children: filteredChildren };

      // Nivo might implicitly calculate parent value from leaves, so remove explicit value
      delete result.value; // Explicitly remove any potentially copied value

      return result;
    }
    return null; // This internal node and its children don't match
  }

  // --- Leaf Node (File) --- //
  let keep = true; // Assume keep unless a filter excludes it

  // Check extension filter first (applies regardless of parent)
  if (extLower && !matchesExt) {
    keep = false;
  }

  // If still potentially kept, check text filter
  // Exclude only if text filter is active, AND leaf doesn't match text, AND parent didn't match text
  if (keep && searchLower && !matchesText && !parentMatchedText) {
    keep = false;
  }

  return keep ? node : null;
}

/**
 * Recursively determines the portion of an original tree that was *excluded* by a filter.
 * It compares the original tree structure with the filtered result.
 *
 * @param originalNode The node from the original, unfiltered Nivo tree.
 * @param filteredNode The corresponding node from the tree after `filterTree` was applied (can be null if filtered out).
 * @param isRoot Flag indicating if the current node is the root of the tree being compared.
 * @returns A Nivo-formatted node representing the filtered-out portion, or null if nothing was filtered out at this level.
 */
export function getFilteredOutTree(
  originalNode: NivoDataNode | null,
  filteredNode: NivoDataNode | null
): NivoDataNode | null {
  if (!originalNode) {
    return null; // Should not happen if called correctly
  }

  // Case 1: Node exists in original but not in filtered -> It was entirely filtered out.
  if (!filteredNode) {
    return originalNode; // Return the original node and its subtree
  }

  // Case 2: Leaf node exists in both original and filtered -> It was *not* filtered out.
  if (!originalNode.children || originalNode.children.length === 0) {
    // If filteredNode exists here, it means the original leaf node matched the filter.
    return null;
  }

  // Case 3: Internal node exists in both original and filtered -> Compare children.
  const filteredOutChildren: NivoDataNode[] = [];
  // Create a map of filtered children for efficient lookup
  const filteredChildrenMap = new Map(
    filteredNode.children?.map((child: NivoDataNode) => [child.id, child]) ?? []
  );

  // Iterate through original children
  for (const originalChild of originalNode.children) {
    const correspondingFilteredChild: NivoDataNode | null =
      filteredChildrenMap.get(originalChild.id) || null;
    // Recursively find what was filtered out in the subtree
    const filteredOutSubtree = getFilteredOutTree(originalChild, correspondingFilteredChild);
    if (filteredOutSubtree) {
      // If the recursive call returned a subtree, it means something was filtered out below this child
      filteredOutChildren.push(filteredOutSubtree);
    }
  }

  // If any children were filtered out (or contained filtered-out descendants),
  // reconstruct this node with only the filtered-out children.
  if (filteredOutChildren.length > 0) {
    const result: NivoDataNode = {
      ...originalNode, // Keep original id, name
      children: filteredOutChildren,
    };

    // Nivo might implicitly calculate parent value from leaves, so remove explicit value
    delete result.value; // Explicitly remove any potentially copied value

    return result;
  }

  // Case 4: Internal node exists in both, and *no* children/descendants were filtered out.
  return null;
}
