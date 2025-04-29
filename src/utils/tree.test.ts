import { calculateSize } from './tree';
import { TreeNode } from '../types';

// Define sample TreeNode data specifically for calculateSize tests
const sampleCalcTreeNode: TreeNode = {
  id: 'root',
  name: 'root',
  key: 'root',
  size: 0, // Initial size doesn't matter, it gets recalculated
  children: [
    {
      id: 'folder1',
      name: 'folder1',
      key: 'folder1',
      size: 0,
      children: [
        { id: 'file1.txt', name: 'file1.txt', size: 100, key: 'file1.txt' }, // Leaf
      ],
    },
    {
      id: 'folder2',
      name: 'folder2',
      key: 'folder2',
      size: 0,
      children: [
        { id: 'file2.txt', name: 'file2.txt', size: 200, key: 'file2.txt' }, // Leaf
        { id: 'file3.txt', name: 'file3.txt', size: 300, key: 'file3.txt' }, // Leaf
      ],
    },
    { id: 'file4.txt', name: 'file4.txt', size: 50, key: 'file4.txt' }, // Leaf at root level
  ],
};

describe('calculateSize', () => {
  // Need a deep copy before each test because the function mutates the object
  let testNode: TreeNode;
  beforeEach(() => {
    testNode = JSON.parse(JSON.stringify(sampleCalcTreeNode));
  });

  it('returns the size of a node with no children', () => {
    const leafNode: TreeNode = { id: 'file.txt', name: 'file.txt', size: 100, key: 'file.txt' };
    const size = calculateSize(leafNode);
    expect(size).toBe(100);
  });

  it('returns 0 for a leaf node with no size property', () => {
    const leafNodeNoSize: TreeNode = {
      id: 'file.txt',
      name: 'file.txt',
      key: 'file.txt',
      size: undefined as any,
    };
    const size = calculateSize(leafNodeNoSize);
    expect(size).toBe(0);
  });

  it('calculates and updates the total size of a simple nested node', () => {
    const folder1 = testNode.children![0]; // folder1
    const expectedSize = 100; // Only file1.txt
    const calculatedSize = calculateSize(folder1);
    expect(calculatedSize).toBe(expectedSize);
    expect(folder1.size).toBe(expectedSize); // Check mutation
  });

  it('calculates and updates the total size of a node with multiple children', () => {
    const folder2 = testNode.children![1]; // folder2
    const expectedSize = 200 + 300; // file2.txt + file3.txt
    const calculatedSize = calculateSize(folder2);
    expect(calculatedSize).toBe(expectedSize);
    expect(folder2.size).toBe(expectedSize); // Check mutation
  });

  it('calculates and updates the total size of the root node with nested children', () => {
    const expectedSize = 100 + 200 + 300 + 50; // file1 + file2 + file3 + file4
    const calculatedSize = calculateSize(testNode);
    expect(calculatedSize).toBe(expectedSize);
    expect(testNode.size).toBe(expectedSize); // Check mutation
  });

  it('handles empty folders correctly', () => {
    const emptyFolder: TreeNode = {
      id: 'empty',
      name: 'empty',
      key: 'empty',
      size: 0,
      children: [],
    };
    const size = calculateSize(emptyFolder);
    expect(size).toBe(0);
    expect(emptyFolder.size).toBe(0);
  });
});
