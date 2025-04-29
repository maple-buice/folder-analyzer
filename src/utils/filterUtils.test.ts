import { filterTree, getFilteredOutTree } from './filterUtils';

// Mock NivoDataNode structure for testing
// (Matches the interface defined in App.tsx)
interface NivoDataNode {
  id: string;
  name: string;
  children?: NivoDataNode[];
  value?: number; // Only present on leaves in source data
}

// Sample data for testing
const sampleTree: NivoDataNode = {
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

describe('filterTree', () => {
  // Test Case 1: No filter
  it('should return the original tree when no filters are applied', () => {
    const result = filterTree(sampleTree, '', '', true);
    expect(result).toEqual(sampleTree); // Should be identical when no filter
  });

  // Test Case 2: Filter by text (name match)
  it('should filter nodes based on matching name text', () => {
    const result = filterTree(sampleTree, 'file', '', true);
    // Only file1.txt directly matches 'file'. folderA and its children do not.
    expect(result).toEqual({
      id: '/root',
      name: 'root', // Root always included if children match
      children: [
        { id: '/root/file1.txt', name: 'file1.txt', value: 100 },
        // folderA and its children excluded as neither match 'file'
        // config.js excluded
      ],
    });
  });

  // Test Case 3: Filter by text (path/id match)
  it('should filter nodes based on matching path (id) text', () => {
    const result = filterTree(sampleTree, 'folderA', '', true);
    expect(result).toEqual({
      id: '/root',
      name: 'root',
      children: [
        // file1.txt excluded
        {
          id: '/root/folderA', // Matches filter directly
          name: 'folderA',
          children: [
            // All original children included because parent matched
            { id: '/root/folderA/image.jpg', name: 'image.jpg', value: 200 },
            { id: '/root/folderA/document.txt', name: 'document.txt', value: 150 },
          ],
        },
        // folderB excluded
        // config.js excluded
      ],
    });
  });

  // Test Case 4: Filter by extension
  it('should filter nodes based on matching file extension', () => {
    const result = filterTree(sampleTree, '', '.txt', true);
    expect(result).toEqual({
      id: '/root',
      name: 'root',
      children: [
        { id: '/root/file1.txt', name: 'file1.txt', value: 100 },
        {
          id: '/root/folderA',
          name: 'folderA', // Kept because child matches
          children: [
            // image.jpg excluded
            { id: '/root/folderA/document.txt', name: 'document.txt', value: 150 },
          ],
        },
        // folderB and its children excluded
        // config.js excluded
      ],
    });
  });

  // Test Case 5: Filter by text AND extension
  it('should filter nodes based on both text and extension', () => {
    const result = filterTree(sampleTree, 'script', '.js', true);
    expect(result).toEqual({
      id: '/root',
      name: 'root',
      children: [
        // file1.txt excluded
        // folderA excluded
        {
          id: '/root/folderB', // Kept because child matches both
          name: 'folderB',
          children: [{ id: '/root/folderB/script.js', name: 'script.js', value: 50 }],
        },
        // config.js excluded (matches ext but not text)
      ],
    });
  });

  // Test Case 6: Filter by text AND extension (no match)
  it('should return null if text and extension filter match nothing', () => {
    const result = filterTree(sampleTree, 'image', '.txt', true);
    // folderA/image.jpg matches text but not ext
    // file1.txt, folderA/document.txt match ext but not text
    expect(result).toBeNull();
  });

  // Test Case 7: Filter matching only a folder name but not its children
  it('should keep a folder if its name matches text, even if children do not match extension', () => {
    const result = filterTree(sampleTree, 'folderA', '.js', true);
    // Expect folderA because it matches text, but its children should be empty
    // because neither image.jpg nor document.txt match the .js extension filter.
    expect(result).toEqual({
      id: '/root',
      name: 'root',
      children: [
        {
          id: '/root/folderA', // Matches text filter
          name: 'folderA',
          children: [], // Children filtered out by extension
        },
      ],
    });
  });

  // Test Case 8: Empty input tree
  it('should return null for a null input node', () => {
    const result = filterTree(null, 'test', '', true);
    expect(result).toBeNull();
  });

  // Test Case 9: Case-insensitivity (Strict AND interpretation)
  it('should perform case-insensitive matching for text and extension', () => {
    const result = filterTree(sampleTree, 'FOLDERA', '.TXT', true);
    // Expect folderA (matches text) containing document.txt (matches text AND extension).
    // file1.txt is excluded because it matches extension but NOT text.
    expect(result).toEqual({
      id: '/root',
      name: 'root',
      children: [
        // file1.txt excluded (matches ext, not text)
        {
          id: '/root/folderA', // Matches text
          name: 'folderA',
          children: [
            // image.jpg excluded (doesn't match ext)
            { id: '/root/folderA/document.txt', name: 'document.txt', value: 150 }, // Matches ext (and implicitly text via parent)
          ],
          // value removed by filterTree
        },
        // folderB excluded
        // config.js excluded
      ],
    });
  });
});

describe('getFilteredOutTree', () => {
  it('should return null if no filter was applied (filteredNode is same as original)', () => {
    const filteredNode = filterTree(sampleTree, '', '', true); // No filter
    const result = getFilteredOutTree(sampleTree, filteredNode, true);
    expect(result).toBeNull();
  });

  it('should return the original tree if the filter removed everything', () => {
    const filteredNode = filterTree(sampleTree, 'nonexistent', '.xyz', true); // Matches nothing
    const result = getFilteredOutTree(sampleTree, filteredNode, true);
    // Expect the original structure back because everything was filtered out
    expect(result).toEqual(sampleTree);
  });

  it('should return the nodes that were filtered out by text', () => {
    // Filter BY 'folderA' (keeps folderA and its children)
    const filteredNode = filterTree(sampleTree, 'folderA', '', true);
    const result = getFilteredOutTree(sampleTree, filteredNode, true);

    // Expect everything EXCEPT folderA and its children
    expect(result).toEqual({
      id: '/root',
      name: 'root',
      // value: undefined (removed)
      children: [
        { id: '/root/file1.txt', name: 'file1.txt', value: 100 },
        // folderA excluded
        {
          id: '/root/folderB',
          name: 'folderB',
          children: [{ id: '/root/folderB/script.js', name: 'script.js', value: 50 }],
          // value: undefined (removed) - getFilteredOutTree might need adjustment
        },
        { id: '/root/config.js', name: 'config.js', value: 20 },
      ],
    });
    // Check that internal node values are handled (may need adjustment in getFilteredOutTree similar to filterTree)
    expect(
      result?.children?.find((c: NivoDataNode) => c.id === '/root/folderB')?.value
    ).toBeUndefined();
  });

  it('should return the nodes that were filtered out by extension', () => {
    // Filter for '.txt' (keeps file1.txt, folderA->document.txt)
    const filteredNode = filterTree(sampleTree, '', '.txt', true);
    const result = getFilteredOutTree(sampleTree, filteredNode, true);

    // Expect everything EXCEPT the .txt files
    expect(result).toEqual({
      id: '/root',
      name: 'root',
      children: [
        // file1.txt excluded
        {
          id: '/root/folderA', // Kept because image.jpg remains
          name: 'folderA',
          children: [
            { id: '/root/folderA/image.jpg', name: 'image.jpg', value: 200 }, // image.jpg remains
            // document.txt excluded
          ],
        },
        {
          id: '/root/folderB', // Kept because script.js remains
          name: 'folderB',
          children: [
            { id: '/root/folderB/script.js', name: 'script.js', value: 50 }, // script.js remains
          ],
        },
        { id: '/root/config.js', name: 'config.js', value: 20 }, // config.js remains
      ],
    });
  });

  it('should correctly identify filtered out parts with combined filters', () => {
    // Filter for text='script', ext='.js' (keeps folderB -> script.js)
    const filteredNode = filterTree(sampleTree, 'script', '.js', true);
    const result = getFilteredOutTree(sampleTree, filteredNode, true);

    // Expect everything EXCEPT the branch kept by the filter (folderB -> script.js).
    // Since script.js was the only child of folderB and it was *not* filtered out,
    // folderB itself should not appear in the filtered-out tree.
    expect(result).toEqual({
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
        { id: '/root/config.js', name: 'config.js', value: 20 },
      ],
    });
  });
});
