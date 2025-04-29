/**
 * Formats a size in bytes into a human-readable string (Bytes, KB, MB, GB).
 *
 * @param bytes The size in bytes.
 * @returns A formatted string representing the size (e.g., "500 Bytes", "1.46 KB", "1.50 MB", "2.75 GB"). Returns "N/A" for invalid input.
 */
export const formatSize = (bytes: number): string => {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return 'N/A'; // Handle invalid input
  }

  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes === 0) return '0 Bytes';

  if (bytes < KB) {
    return `${bytes} Bytes`;
  } else if (bytes < MB) {
    return `${(bytes / KB).toFixed(2)} KB`;
  } else if (bytes < GB) {
    return `${(bytes / MB).toFixed(2)} MB`;
  } else {
    return `${(bytes / GB).toFixed(2)} GB`;
  }
};
