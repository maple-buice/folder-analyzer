// src/utils/treeUtils.test.ts

import {
  getDisplayPath,
  getExtensionsFromTree, // Need TreeNode type
  toNivoTree, // Need TreeNode type
  calculateNivoTreeSize,
  calculateExtensionNivoSizes,
  findNodeById,
} from './treeUtils';
import { TreeNode, NivoDataNode } from '../types'; // Import TreeNode and NivoDataNode

// Sample NivoDataNode data (uses NivoDataNode type)
const sampleNivoTree: NivoDataNode = {
  id: '/root',
  name: 'root',
  children: [
    { id: '/root/file1.txt', name: 'file1.txt', value: 100 },
    {
      id: '/root/folderA',
      name: 'folderA',
      children: [
        { id: '/root/folderA/image.jpg', name: 'image.jpg', value: 200 },
        { id: '/root/folderA/document.txt', name: 'document.txt', value: 150 },
      ],
    },
    {
      id: '/root/folderB',
      name: 'folderB',
      children: [{ id: '/root/folderB/script.js', name: 'script.js', value: 50 }],
    },
    { id: '/root/config.js', name: 'config.js', value: 20 },
  ],
};

// Sample TreeNode data (uses TreeNode type)
const sampleTreeNode: TreeNode = {
  id: '/root',
  name: 'root',
  size: 520, // Total size
  key: '/root', // Added key
  children: [
    { id: '/root/file1.txt', name: 'file1.txt', size: 100, key: '/root/file1.txt' }, // Added key
    {
      id: '/root/folderA',
      name: 'folderA',
      size: 350,
      key: '/root/folderA', // Added key
      children: [
        {
          id: '/root/folderA/image.jpg',
          name: 'image.jpg',
          size: 200,
          key: '/root/folderA/image.jpg',
        }, // Added key
        {
          id: '/root/folderA/document.txt',
          name: 'document.txt',
          size: 150,
          key: '/root/folderA/document.txt',
        }, // Added key
      ],
    },
    {
      id: '/root/folderB',
      name: 'folderB',
      size: 50,
      key: '/root/folderB', // Added key
      children: [
        {
          id: '/root/folderB/script.js',
          name: 'script.js',
          size: 50,
          key: '/root/folderB/script.js',
        }, // Added key
      ],
    },
    { id: '/root/config.js', name: 'config.js', size: 20, key: '/root/config.js' }, // Added key
  ],
};

// --- Tests for treeUtils ---

// Mocking path.sep for cross-platform testing
jest.mock('path', () => ({
  ...jest.requireActual('path'), // Use actual path functions if needed elsewhere
  sep: '/', // Force '/' as separator for consistent testing
}));

describe('getDisplayPath', () => {
  it('should return the full path if folderPath is empty', () => {
    expect(getDisplayPath('/absolute/path/to/file.txt', '')).toBe('/absolute/path/to/file.txt');
  });

  it('should return the relative path correctly', () => {
    expect(getDisplayPath('/abs/path/folder/file.txt', '/abs/path/folder')).toBe('file.txt');
  });

  it('should handle folderPath with trailing separator', () => {
    expect(getDisplayPath('/abs/path/folder/file.txt', '/abs/path/folder/')).toBe('file.txt');
  });

  it('should return the full path if it does not start with folderPath', () => {
    expect(getDisplayPath('/other/path/file.txt', '/abs/path/folder')).toBe('/other/path/file.txt');
  });

  it('should handle root path correctly', () => {
    expect(getDisplayPath('/file.txt', '/')).toBe('file.txt');
  });
});

describe('getExtensionsFromTree', () => {
  it('should return an empty set for a null node', () => {
    expect(getExtensionsFromTree(null)).toEqual(new Set());
  });

  it('should return an empty set for a tree with no files', () => {
    const treeWithoutFiles: TreeNode = {
      id: '/root',
      name: 'root',
      size: 0,
      key: '/root',
      children: [{ id: '/root/folder', name: 'folder', size: 0, key: '/root/folder' }],
    };
    expect(getExtensionsFromTree(treeWithoutFiles)).toEqual(new Set());
  });

  it('should extract unique lowercase extensions from the sample tree', () => {
    // Based on sampleTreeNode: file1.txt, image.jpg, document.txt, script.js, config.js
    const expectedExtensions = new Set(['.txt', '.jpg', '.js']);
    expect(getExtensionsFromTree(sampleTreeNode)).toEqual(expectedExtensions);
  });

  it('should ignore files without extensions', () => {
    const treeWithNoExt: TreeNode = {
      id: '/root',
      name: 'root',
      size: 100,
      key: '/root',
      children: [{ id: '/root/noext', name: 'noext', size: 100, key: '/root/noext' }],
    };
    expect(getExtensionsFromTree(treeWithNoExt)).toEqual(new Set());
  });

  it('should ignore hidden files starting with a dot', () => {
    const treeWithHidden: TreeNode = {
      id: '/root',
      name: 'root',
      size: 10,
      key: '/root',
      children: [{ id: '/root/.env', name: '.env', size: 10, key: '/root/.env' }],
    };
    expect(getExtensionsFromTree(treeWithHidden)).toEqual(new Set());
  });
});

describe('toNivoTree', () => {
  it('should convert TreeNode to NivoDataNode structure correctly', () => {
    const result = toNivoTree(sampleTreeNode, true); // Pass isRoot = true for top level
    // Compare structure, ensuring 'value' is only on leaves
    const expectedNivoStructure = {
      id: '/root',
      name: 'root', // No value on root
      children: [
        { id: '/root/file1.txt', name: 'file1.txt', value: 100 }, // Leaf has value
        {
          id: '/root/folderA',
          name: 'folderA', // Internal node has no value
          children: [
            { id: '/root/folderA/image.jpg', name: 'image.jpg', value: 200 },
            { id: '/root/folderA/document.txt', name: 'document.txt', value: 150 },
          ],
        },
        {
          id: '/root/folderB',
          name: 'folderB', // Internal node has no value
          children: [{ id: '/root/folderB/script.js', name: 'script.js', value: 50 }],
        },
        { id: '/root/config.js', name: 'config.js', value: 20 }, // Leaf has value
      ],
    };
    expect(result).toEqual(expectedNivoStructure);
  });

  it('should handle nodes with missing size (assign value 1)', () => {
    // Added key and size: undefined to satisfy TreeNode type
    const nodeWithoutSize: TreeNode = { id: 'a', name: 'a.txt', key: 'a', size: undefined as any }; // Using undefined for size
    const result = toNivoTree(nodeWithoutSize);
    expect(result.value).toBe(1);
  });

  it('should handle nodes with zero size (assign value 1)', () => {
    // Added key to satisfy TreeNode type
    const nodeWithZeroSize: TreeNode = { id: 'a', name: 'a.txt', size: 0, key: 'a' };
    const result = toNivoTree(nodeWithZeroSize);
    expect(result.value).toBe(1);
  });
});

describe('calculateNivoTreeSize', () => {
  it('should return 0 for a null node', () => {
    expect(calculateNivoTreeSize(null)).toBe(0);
  });

  it('should return the value of a leaf node', () => {
    expect(calculateNivoTreeSize({ id: 'a', name: 'a', value: 123 })).toBe(123);
  });

  it('should return 0 for a leaf node with no value', () => {
    expect(calculateNivoTreeSize({ id: 'a', name: 'a' })).toBe(0);
  });

  it('should correctly sum the values of all leaf nodes in a tree', () => {
    // Uses sampleNivoTree defined above
    expect(calculateNivoTreeSize(sampleNivoTree)).toBe(100 + 200 + 150 + 50 + 20); // 520
  });

  it('should return 0 for a tree with no leaf values', () => {
    const treeWithoutValues: NivoDataNode = {
      id: 'root',
      name: 'root',
      children: [{ id: 'a', name: 'a' }],
    };
    expect(calculateNivoTreeSize(treeWithoutValues)).toBe(0);
  });
});

describe('calculateExtensionNivoSizes', () => {
  it('should return an empty object for a null node', () => {
    expect(calculateExtensionNivoSizes(null)).toEqual({});
  });

  it('should correctly calculate sizes for different extensions', () => {
    // Uses sampleNivoTree defined above
    const expectedSizes = {
      '.txt': 100 + 150, // 250
      '.jpg': 200,
      '.js': 50 + 20, // 70
    };
    expect(calculateExtensionNivoSizes(sampleNivoTree)).toEqual(expectedSizes);
  });

  it('should handle files with no extension', () => {
    const treeWithNoExt: NivoDataNode = {
      id: 'root',
      name: 'root',
      children: [{ id: 'file', name: 'file', value: 50 }],
    };
    expect(calculateExtensionNivoSizes(treeWithNoExt)).toEqual({});
  });

  it('should handle files starting with a dot (hidden files)', () => {
    const treeWithHidden: NivoDataNode = {
      id: 'root',
      name: 'root',
      children: [{ id: '.env', name: '.env', value: 10 }],
    };
    expect(calculateExtensionNivoSizes(treeWithHidden)).toEqual({}); // No extension added
  });

  it('should be case-insensitive for extensions', () => {
    const treeWithCapsExt: NivoDataNode = {
      id: 'root',
      name: 'root',
      children: [{ id: 'FILE.TXT', name: 'FILE.TXT', value: 100 }],
    };
    expect(calculateExtensionNivoSizes(treeWithCapsExt)).toEqual({ '.txt': 100 });
  });
});

describe('findNodeById', () => {
  it('should return null if the node is not found', () => {
    expect(findNodeById(sampleNivoTree, '/nonexistent')).toBeNull();
  });

  it('should return null for a null input node', () => {
    expect(findNodeById(null, '/root')).toBeNull();
  });

  it('should find the root node', () => {
    const result = findNodeById(sampleNivoTree, '/root');
    expect(result).toBe(sampleNivoTree); // Should return the exact object
  });

  it('should find a nested leaf node', () => {
    const expectedNode = sampleNivoTree?.children?.[1]?.children?.[1]; // /root/folderA/document.txt
    const result = findNodeById(sampleNivoTree, '/root/folderA/document.txt');
    expect(result).toEqual(expectedNode);
  });

  it('should find a nested internal node', () => {
    const expectedNode = sampleNivoTree?.children?.[1]; // /root/folderA
    const result = findNodeById(sampleNivoTree, '/root/folderA');
    expect(result).toEqual(expectedNode);
  });
});
