import { TreeNode } from '../types';

export const calculateSize = (node: TreeNode): number => {
  if (!node.children) return node.size || 0;
  // Folder node
  const size = node.children.reduce(
    (acc: number, child: TreeNode) => acc + calculateSize(child),
    0
  );
  node.size = size;
  return size;
};

// Add more tree utilities here as needed
