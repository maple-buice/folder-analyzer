/**
 * Formats a size in bytes into a human-readable string (KB or MB).
 *
 * @param bytes The size in bytes.
 * @returns A formatted string representing the size (e.g., "123.45 KB", "67.89 MB").
 */
export const formatSize = (bytes: number): string => {
  if (bytes <= 0) return '0 KB'; // Handle zero or negative bytes
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
};
