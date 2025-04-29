// Shared types for Folder Sunburst Explorer

export interface TreeNode {
  id: string; // unique identifier (usually the full path)
  name: string;
  children?: TreeNode[];
  size: number;
  key: string; // legacy, for compatibility
  processingErrors?: string[]; // Add optional array for errors
}

export interface ApiResponse {
  message: string;
  tree: TreeNode | null; // Allow null tree, e.g., on initial error
  errors?: string[]; // Optional array for specific access errors during processing
}

// Add the centralized NivoDataNode interface
export interface NivoDataNode {
  id: string; // Ensure id is always string in our data
  name: string;
  children?: NivoDataNode[];
  value?: number; // Nivo uses 'value' for size, typically only on leaves
}
