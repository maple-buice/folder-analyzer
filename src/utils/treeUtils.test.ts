// src/utils/treeUtils.test.ts

import {
  getDisplayPath,
  getExtensionsFromTree, // Need TreeNode type
  toNivoTree, // Need TreeNode type
  calculateNivoTreeSize,
  calculateExtensionNivoSizes,
  findNodeById,
  pruneTreeDepth, // Added import
  calculateNivoTreeNodeCount, // Added import
  calculateNodesPerDepth, // Added import
  calculateDynamicDepth, // Added import
} from './treeUtils';
import { TreeNode, NivoDataNode } from '../types'; // Import TreeNode and NivoDataNode
import { spyOn, beforeAll, afterAll, describe, it, expect } from 'bun:test'; // Add beforeAll/afterAll
import path from 'path'; // Import the actual path module

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
  children: [
    { id: '/root/file1.txt', name: 'file1.txt', size: 100 }, // Added key
    {
      id: '/root/folderA',
      name: 'folderA',
      size: 350,
      children: [
        {
          id: '/root/folderA/image.jpg',
          name: 'image.jpg',
          size: 200,
        }, // Added key
        {
          id: '/root/folderA/document.txt',
          name: 'document.txt',
          size: 150,
        }, // Added key
      ],
    },
    {
      id: '/root/folderB',
      name: 'folderB',
      size: 50,
      children: [
        {
          id: '/root/folderB/script.js',
          name: 'script.js',
          size: 50,
        }, // Added key
      ],
    },
    { id: '/root/config.js', name: 'config.js', size: 20 }, // Added key
  ],
};

// Sample tree for dynamic depth testing
const depthTestTree: NivoDataNode = {
  id: 'root',
  name: 'root', // 1 node @ depth 0
  children: [
    { id: 'd1a', name: 'd1a' }, // 2 nodes @ depth 1
    {
      id: 'd1b',
      name: 'd1b',
      children: [
        { id: 'd2a', name: 'd2a' }, // 4 nodes @ depth 2
        { id: 'd2b', name: 'd2b' },
        { id: 'd2c', name: 'd2c' },
        {
          id: 'd2d',
          name: 'd2d',
          children: [
            { id: 'd3a', name: 'd3a' }, // 2 nodes @ depth 3
            { id: 'd3b', name: 'd3b' },
          ],
        },
      ],
    },
  ],
};
// Counts per depth: [1, 2, 4, 2] -> Total nodes = 9
// Cumulative counts: [1, 3, 7, 9]

// --- Tests for treeUtils ---

describe('getDisplayPath', () => {
  it('should return the full path if folderPath is empty', () => {
    expect(getDisplayPath('/absolute/path/to/file.txt', '')).toBe('/absolute/path/to/file.txt');
  });

  it('should return the relative path correctly', () => {
    const folder = path.join('abs', 'path', 'folder');
    const file = path.join(folder, 'file.txt');
    expect(getDisplayPath(file, folder)).toBe('file.txt');
  });

  it('should handle folderPath with trailing separator', () => {
    const folder = path.join('abs', 'path', 'folder') + path.sep;
    const file = path.join('abs', 'path', 'folder', 'file.txt');
    expect(getDisplayPath(file, folder)).toBe('file.txt');
  });

  it('should return the full path if it does not start with folderPath', () => {
    const folder = path.join('abs', 'path', 'folder');
    const file = path.join('other', 'path', 'file.txt');
    expect(getDisplayPath(file, folder)).toBe(file);
  });

  it('should handle root path correctly', () => {
    const file = path.join(path.sep, 'file.txt');
    expect(getDisplayPath(file, path.sep)).toBe('file.txt');
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
      children: [{ id: '/root/folder', name: 'folder', size: 0 }],
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
      children: [{ id: '/root/noext', name: 'noext', size: 100 }],
    };
    expect(getExtensionsFromTree(treeWithNoExt)).toEqual(new Set());
  });

  it('should ignore hidden files starting with a dot', () => {
    const treeWithHidden: TreeNode = {
      id: '/root',
      name: 'root',
      size: 10,
      children: [{ id: '/root/.env', name: '.env', size: 10 }],
    };
    expect(getExtensionsFromTree(treeWithHidden)).toEqual(new Set());
  });
});

describe('toNivoTree', () => {
  it('should convert TreeNode to NivoDataNode structure correctly', () => {
    const result = toNivoTree(sampleTreeNode);
    // Compare structure, ensuring 'value' is only on leaves
    const expectedNivoStructure: NivoDataNode = {
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
    const nodeWithoutSize: TreeNode = {
      id: 'a',
      name: 'a.txt',
      size: undefined as never as number,
    }; // Using undefined for size
    const result = toNivoTree(nodeWithoutSize);
    expect(result.value).toBe(1);
  });

  it('should handle nodes with zero size (assign value 1)', () => {
    // Added key to satisfy TreeNode type
    const nodeWithZeroSize: TreeNode = { id: 'a', name: 'a.txt', size: 0 };
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
    const expectedNode = sampleNivoTree?.children?.[1]?.children?.[1] || null; // /root/folderA/document.txt
    const result = findNodeById(sampleNivoTree, '/root/folderA/document.txt');
    expect(result).toEqual(expectedNode);
  });

  it('should find a nested internal node', () => {
    const expectedNode = sampleNivoTree?.children?.[1] || null; // /root/folderA
    const result = findNodeById(sampleNivoTree, '/root/folderA');
    expect(result).toEqual(expectedNode);
  });
});

// --- Tests for pruneTreeDepth ---
describe('pruneTreeDepth', () => {
  // Use a slightly deeper sample tree for pruning tests
  const deepSampleTree: NivoDataNode = {
    id: '/',
    name: 'root',
    children: [
      {
        id: '/a',
        name: 'a',
        children: [
          {
            id: '/a/b',
            name: 'b',
            children: [
              { id: '/a/b/c', name: 'c', value: 10 }, // Depth 3
              {
                id: '/a/b/d',
                name: 'd',
                children: [
                  { id: '/a/b/d/e', name: 'e', value: 20 }, // Depth 4
                ],
              }, // Depth 3
            ],
          }, // Depth 2
        ],
      }, // Depth 1
      { id: '/f', name: 'f', value: 30 }, // Depth 1
    ],
  }; // Depth 0

  it('should return null for null input', () => {
    expect(pruneTreeDepth(null, 5)).toBeNull();
  });

  it('should return the original tree if maxDepth is large enough', () => {
    const result = pruneTreeDepth(deepSampleTree, 10);
    expect(result).toEqual(deepSampleTree); // Should be unchanged
  });

  it('should return the original tree if maxDepth is negative', () => {
    const result = pruneTreeDepth(deepSampleTree, -1);
    expect(result).toEqual(deepSampleTree); // Should be unchanged
  });

  it('should prune nodes beyond maxDepth (depth 2)', () => {
    const result = pruneTreeDepth(deepSampleTree, 2);
    const expected = {
      id: '/',
      name: 'root',
      children: [
        {
          id: '/a',
          name: 'a',
          children: [
            { id: '/a/b', name: 'b' }, // Children of 'b' removed (/a/b/c, /a/b/d)
          ],
        },
        { id: '/f', name: 'f', value: 30 },
      ],
    };
    expect(result).toEqual(expected);
  });

  it('should prune nodes beyond maxDepth (depth 3)', () => {
    const result = pruneTreeDepth(deepSampleTree, 3);
    const expected = {
      id: '/',
      name: 'root',
      children: [
        {
          id: '/a',
          name: 'a',
          children: [
            {
              id: '/a/b',
              name: 'b',
              children: [
                { id: '/a/b/c', name: 'c', value: 10 },
                { id: '/a/b/d', name: 'd' }, // Children of 'd' removed (/a/b/d/e)
              ],
            },
          ],
        },
        { id: '/f', name: 'f', value: 30 },
      ],
    };
    expect(result).toEqual(expected);
  });

  it('should handle maxDepth 0 (only root)', () => {
    const result = pruneTreeDepth(deepSampleTree, 0);
    const expected = {
      id: '/',
      name: 'root', // Children removed
    };
    expect(result).toEqual(expected);
  });

  it('should not mutate the original tree', () => {
    const originalCopy = JSON.parse(JSON.stringify(deepSampleTree));
    pruneTreeDepth(deepSampleTree, 2);
    expect(deepSampleTree).toEqual(originalCopy);
  });
});

// --- Tests for calculateNivoTreeNodeCount ---
describe('calculateNivoTreeNodeCount', () => {
  it('should return 0 for a null node', () => {
    expect(calculateNivoTreeNodeCount(null)).toBe(0);
  });

  it('should return 1 for a single leaf node', () => {
    const leaf: NivoDataNode = { id: 'a', name: 'a', value: 10 };
    expect(calculateNivoTreeNodeCount(leaf)).toBe(1);
  });

  it('should count nodes in the sample tree correctly', () => {
    // Root + file1 + folderA + image + document + folderB + script + config = 8 nodes
    expect(calculateNivoTreeNodeCount(sampleNivoTree)).toBe(8);
  });

  it('should count nodes in the deep sample tree correctly', () => {
    const deepSampleTree: NivoDataNode = {
      id: '/',
      name: 'root',
      children: [
        {
          id: '/a',
          name: 'a',
          children: [
            {
              id: '/a/b',
              name: 'b',
              children: [
                { id: '/a/b/c', name: 'c', value: 10 },
                { id: '/a/b/d', name: 'd', children: [{ id: '/a/b/d/e', name: 'e', value: 20 }] },
              ],
            },
          ],
        },
        { id: '/f', name: 'f', value: 30 },
      ],
    };
    // root + a + b + c + d + e + f = 7 nodes
    expect(calculateNivoTreeNodeCount(deepSampleTree)).toBe(7);
  });
});

// --- Tests for calculateNodesPerDepth ---
describe('calculateNodesPerDepth', () => {
  it('should return an empty array for a null node', () => {
    expect(calculateNodesPerDepth(null)).toEqual([]);
  });

  it('should return [1] for a single leaf node', () => {
    const leaf: NivoDataNode = { id: 'a', name: 'a', value: 10 };
    expect(calculateNodesPerDepth(leaf)).toEqual([1]);
  });

  it('should return correct counts for the sample tree', () => {
    // Depth 0: root (1)
    // Depth 1: file1, folderA, folderB, config (4)
    // Depth 2: image, document, script (3)
    expect(calculateNodesPerDepth(sampleNivoTree)).toEqual([1, 4, 3]);
  });

  it('should return correct counts for the deep sample tree', () => {
    const deepSampleTree: NivoDataNode = {
      id: '/',
      name: 'root',
      children: [
        {
          id: '/a',
          name: 'a',
          children: [
            {
              id: '/a/b',
              name: 'b',
              children: [
                { id: '/a/b/c', name: 'c', value: 10 },
                { id: '/a/b/d', name: 'd', children: [{ id: '/a/b/d/e', name: 'e', value: 20 }] },
              ],
            },
          ],
        },
        { id: '/f', name: 'f', value: 30 },
      ],
    };
    // Depth 0: root (1)
    // Depth 1: a, f (2)
    // Depth 2: b (1)
    // Depth 3: c, d (2)
    // Depth 4: e (1)
    expect(calculateNodesPerDepth(deepSampleTree)).toEqual([1, 2, 1, 2, 1]);
  });
});

// --- Tests for calculateDynamicDepth ---
describe('calculateDynamicDepth', () => {
  const MIN_DEPTH = 3;
  const FULL_DEPTH = 100;

  // Suppress console logs from the utility during tests
  let consoleSpy: ReturnType<typeof spyOn>;
  beforeAll(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
  });
  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it('should return fullDepth for a null node', () => {
    expect(calculateDynamicDepth(null, 50, MIN_DEPTH, FULL_DEPTH)).toBe(FULL_DEPTH);
  });

  it('should return fullDepth if total nodes are below or equal to threshold', () => {
    // Threshold = 10, Total nodes = 9
    expect(calculateDynamicDepth(depthTestTree, 10, MIN_DEPTH, FULL_DEPTH)).toBe(FULL_DEPTH);
    // Threshold = 9, Total nodes = 9
    expect(calculateDynamicDepth(depthTestTree, 9, MIN_DEPTH, FULL_DEPTH)).toBe(FULL_DEPTH);
  });

  it('should return calculated depth when total nodes exceed threshold', () => {
    // Threshold = 8 (allows cumulative 7 -> depth 2)
    expect(calculateDynamicDepth(depthTestTree, 8, MIN_DEPTH, FULL_DEPTH)).toBe(3); // Hits minDepth
    // Threshold = 7 (allows cumulative 7 -> depth 2)
    expect(calculateDynamicDepth(depthTestTree, 7, MIN_DEPTH, FULL_DEPTH)).toBe(3); // Hits minDepth
    // Threshold = 6 (allows cumulative 3 -> depth 1)
    expect(calculateDynamicDepth(depthTestTree, 6, MIN_DEPTH, FULL_DEPTH)).toBe(3); // Hits minDepth
    // Threshold = 3 (allows cumulative 3 -> depth 1)
    expect(calculateDynamicDepth(depthTestTree, 3, MIN_DEPTH, FULL_DEPTH)).toBe(3); // Hits minDepth
    // Threshold = 2 (allows cumulative 1 -> depth 0)
    expect(calculateDynamicDepth(depthTestTree, 2, MIN_DEPTH, FULL_DEPTH)).toBe(3); // Hits minDepth
  });

  it('should respect minPruneDepth when calculated depth is lower', () => {
    // Threshold = 5 (allows cumulative 3 -> depth 1), minDepth = 2
    expect(calculateDynamicDepth(depthTestTree, 5, 2, FULL_DEPTH)).toBe(2); // minDepth overrides calculated 1
    // Threshold = 2 (allows cumulative 1 -> depth 0), minDepth = 1
    expect(calculateDynamicDepth(depthTestTree, 2, 1, FULL_DEPTH)).toBe(1); // minDepth overrides calculated 0
    // Threshold = 2 (allows cumulative 1 -> depth 0), minDepth = 0
    expect(calculateDynamicDepth(depthTestTree, 2, 0, FULL_DEPTH)).toBe(0); // minDepth allows calculated 0
  });

  it('should return correct depth based on cumulative count exactly matching threshold', () => {
    // Threshold = 7 (allows cumulative 7 -> depth 2)
    expect(calculateDynamicDepth(depthTestTree, 7, 0, FULL_DEPTH)).toBe(2);
    // Threshold = 3 (allows cumulative 3 -> depth 1)
    expect(calculateDynamicDepth(depthTestTree, 3, 0, FULL_DEPTH)).toBe(1);
    // Threshold = 1 (allows cumulative 1 -> depth 0)
    expect(calculateDynamicDepth(depthTestTree, 1, 0, FULL_DEPTH)).toBe(0);
  });
});
