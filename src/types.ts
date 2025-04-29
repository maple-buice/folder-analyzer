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
  tree: TreeNode | null; // Allow null tree, e.g., on initial error
  errors?: string[]; // Optional array for specific access errors during processing
}
