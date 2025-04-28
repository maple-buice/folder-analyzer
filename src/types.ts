// Shared types for Folder Sunburst Explorer

export interface TreeNode {
  id: string; // unique identifier (usually the full path)
  name: string;
  children?: TreeNode[];
  size: number;
  key: string; // legacy, for compatibility
}

export interface ApiResponse {
  message: string;
  tree: TreeNode;
}
