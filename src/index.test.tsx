import { processFiles } from './index';
import { TreeNode } from './types';
import { calculateSize } from './utils/tree';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// --- Helper: Create a mock Dirent object for folder analysis ---
function createMockDirent(name: string, isFile: boolean): fs.Dirent {
  return {
    name,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  } as unknown as fs.Dirent;
}

// --- Mock fs.readdirSync and fs.statSync for various scenarios ---
const readdirSyncDirentMock = jest.fn((pathArg: fs.PathLike, options: any) => {
  const pathStr = pathArg.toString();
  let result: fs.Dirent[] = [];
  if (pathStr === '/test') {
    result = [
      createMockDirent('file1.txt', true),
      createMockDirent('file2.txt', true),
      createMockDirent('folder1', false),
    ];
  } else if (pathStr === '/test/folder1') {
    result = [createMockDirent('file3.txt', true)];
  }
  return result;
});

const readdirSyncStringMock = jest.fn((pathArg: fs.PathLike, options?: any) => {
  const pathStr = pathArg.toString();
  let result: string[] = [];
  if (pathStr === '/test') {
    result = ['file1.txt', 'file2.txt', 'folder1'];
  } else if (pathStr === '/test/folder1') {
    result = ['file3.txt'];
  }
  return result;
});

mockFs.readdirSync.mockImplementation(((pathArg: fs.PathLike, options?: any) => {
  if (options && options.withFileTypes) {
    return readdirSyncDirentMock(pathArg, options);
  } else {
    return readdirSyncStringMock(pathArg, options);
  }
}) as unknown as typeof fs.readdirSync);

mockFs.statSync.mockImplementation((path: fs.PathLike) => {
  const pathStr = path.toString();
  // Treat anything ending in .txt as a file, otherwise as a directory
  const isFile = pathStr.endsWith('.txt');
  return {
    isFile: () => isFile,
    size: 100,
  } as fs.Stats;
});

// --- Tests for processFiles (folder analysis) ---
describe('processFiles (folder analysis)', () => {
  it('returns correct structure and sizes for a simple folder', () => {
    const folderPath = '/test';
    const result = processFiles(folderPath);
    expect(result).toEqual({
      id: '/test',
      name: 'root',
      children: [
        { id: '/test/file1.txt', name: 'file1.txt', size: 100, key: '/test/file1.txt' },
        { id: '/test/file2.txt', name: 'file2.txt', size: 100, key: '/test/file2.txt' },
        {
          id: '/test/folder1',
          name: 'folder1',
          children: [
            {
              id: '/test/folder1/file3.txt',
              name: 'file3.txt',
              size: 100,
              key: '/test/folder1/file3.txt',
            },
          ],
          size: 100,
          key: '/test/folder1',
        },
      ],
      size: 300,
      key: '/test',
    });
  });
});

describe('calculateSize', () => {
  it('returns the size of a node with no children', () => {
    const node: TreeNode = { id: 'file.txt', name: 'file.txt', size: 100, key: 'file.txt' };
    const size = calculateSize(node);
    expect(size).toBe(100);
  });

  it('calculates the total size of a node with multiple children', () => {
    const node: TreeNode = {
      id: 'folder',
      name: 'folder',
      children: [
        { id: 'file1.txt', name: 'file1.txt', size: 100, key: 'file1.txt' },
        { id: 'file2.txt', name: 'file2.txt', size: 200, key: 'file2.txt' },
      ],
      size: 0,
      key: 'folder',
    };
    const size = calculateSize(node);
    expect(size).toBe(300);
  });

  it('calculates the total size of a node with nested children', () => {
    const node: TreeNode = {
      id: 'root',
      name: 'root',
      children: [
        {
          id: 'folder1',
          name: 'folder1',
          children: [{ id: 'file1.txt', name: 'file1.txt', size: 100, key: 'file1.txt' }],
          size: 0,
          key: 'folder1',
        },
        {
          id: 'folder2',
          name: 'folder2',
          children: [
            { id: 'file2.txt', name: 'file2.txt', size: 200, key: 'file2.txt' },
            { id: 'file3.txt', name: 'file3.txt', size: 300, key: 'file3.txt' },
          ],
          size: 0,
          key: 'folder2',
        },
      ],
      size: 0,
      key: 'root',
    };
    const size = calculateSize(node);
    expect(size).toBe(600);
  });
});

// --- Helper for additional tests to mock readdirSync for both overloads ---
function makeReaddirSyncMock(mapping: Record<string, string[]>, fileSet: Set<string> = new Set()) {
  return (pathArg: fs.PathLike, options?: any) => {
    const pathStr = pathArg.toString();
    const entries = mapping[pathStr] || [];
    if (options && options.withFileTypes) {
      // Return Dirent[]
      return entries.map((name) => createMockDirent(name, fileSet.has(`${pathStr}/${name}`)));
    }
    return entries;
  };
}

describe('processFiles - additional coverage', () => {
  afterEach(() => {
    mockFs.readdirSync.mockReset();
    mockFs.statSync.mockReset();
    // Restore default mock for other tests
    mockFs.readdirSync.mockImplementation(((pathArg: fs.PathLike, options?: any) => {
      if (options && options.withFileTypes) {
        return readdirSyncDirentMock(pathArg, options);
      } else {
        return readdirSyncStringMock(pathArg, options);
      }
    }) as unknown as typeof fs.readdirSync);
    mockFs.statSync.mockImplementation((path: fs.PathLike) => {
      const pathStr = path.toString();
      // Treat anything ending in .txt as a file, otherwise as a directory
      const isFile = pathStr.endsWith('.txt');
      return {
        isFile: () => isFile,
        size: 100,
      } as fs.Stats;
    });
  });

  it('returns correct structure for an empty folder', () => {
    mockFs.readdirSync.mockImplementation(
      makeReaddirSyncMock({ '/empty': [] }) as unknown as typeof fs.readdirSync
    );
    const result = processFiles('/empty');
    expect(result).toEqual({
      id: '/empty',
      name: 'root',
      children: [],
      size: 0,
      key: '/empty',
    });
  });

  it('returns correct structure for a deeply nested folder', () => {
    const mapping = {
      '/deep': ['level1'],
      '/deep/level1': ['level2'],
      '/deep/level1/level2': ['file.txt'],
      '/deep/level1/level2/file.txt': [],
    };
    const fileSet = new Set(['/deep/level1/level2/file.txt']);
    mockFs.readdirSync.mockImplementation(
      makeReaddirSyncMock(mapping, fileSet) as unknown as typeof fs.readdirSync
    );
    mockFs.statSync.mockImplementation((pathArg: fs.PathLike) => {
      const pathStr = pathArg.toString();
      return {
        isFile: () => pathStr.endsWith('.txt'),
        size: pathStr.endsWith('.txt') ? 42 : 0,
      } as fs.Stats;
    });
    const result = processFiles('/deep');
    expect(result).toEqual({
      id: '/deep',
      name: 'root',
      children: [
        {
          id: '/deep/level1',
          name: 'level1',
          children: [
            {
              id: '/deep/level1/level2',
              name: 'level2',
              children: [
                {
                  id: '/deep/level1/level2/file.txt',
                  name: 'file.txt',
                  size: 42,
                  key: '/deep/level1/level2/file.txt',
                },
              ],
              size: 42,
              key: '/deep/level1/level2',
            },
          ],
          size: 42,
          key: '/deep/level1',
        },
      ],
      size: 42,
      key: '/deep',
    });
  });

  it('returns correct structure for files with size 0', () => {
    mockFs.readdirSync.mockImplementation(
      makeReaddirSyncMock(
        { '/zero': ['zero.txt'] },
        new Set(['/zero/zero.txt'])
      ) as unknown as typeof fs.readdirSync
    );
    mockFs.statSync.mockImplementation(
      (pathArg: fs.PathLike) => ({ isFile: () => true, size: 0 }) as fs.Stats
    );
    const result = processFiles('/zero');
    expect(result).toEqual({
      id: '/zero',
      name: 'root',
      children: [{ id: '/zero/zero.txt', name: 'zero.txt', size: 0, key: '/zero/zero.txt' }],
      size: 0,
      key: '/zero',
    });
  });

  it('returns correct structure for a folder with only folders', () => {
    mockFs.readdirSync.mockImplementation(
      makeReaddirSyncMock({
        '/folders': ['a', 'b'],
        '/folders/a': [],
        '/folders/b': [],
      }) as unknown as typeof fs.readdirSync
    );
    mockFs.statSync.mockImplementation((pathArg: fs.PathLike) => {
      return {
        isFile: () => false,
        size: 0,
      } as fs.Stats;
    });
    const result = processFiles('/folders');
    expect(result).toEqual({
      id: '/folders',
      name: 'root',
      children: [
        { id: '/folders/a', name: 'a', children: [], size: 0, key: '/folders/a' },
        { id: '/folders/b', name: 'b', children: [], size: 0, key: '/folders/b' },
      ],
      size: 0,
      key: '/folders',
    });
  });

  it('returns correct structure for a folder with only files', () => {
    mockFs.readdirSync.mockImplementation(
      makeReaddirSyncMock(
        { '/files': ['f1.txt', 'f2.txt'] },
        new Set(['/files/f1.txt', '/files/f2.txt'])
      ) as unknown as typeof fs.readdirSync
    );
    mockFs.statSync.mockImplementation((pathArg: fs.PathLike) => {
      return {
        isFile: () => true,
        size: 10,
      } as fs.Stats;
    });
    const result = processFiles('/files');
    expect(result).toEqual({
      id: '/files',
      name: 'root',
      children: [
        { id: '/files/f1.txt', name: 'f1.txt', size: 10, key: '/files/f1.txt' },
        { id: '/files/f2.txt', name: 'f2.txt', size: 10, key: '/files/f2.txt' },
      ],
      size: 20,
      key: '/files',
    });
  });

  it('returns correct structure for a folder with mixed files and folders', () => {
    mockFs.readdirSync.mockImplementation(
      makeReaddirSyncMock(
        {
          '/mixed': ['file.txt', 'sub'],
          '/mixed/sub': ['inner.txt'],
          '/mixed/sub/inner.txt': [],
        },
        new Set(['/mixed/file.txt', '/mixed/sub/inner.txt'])
      ) as unknown as typeof fs.readdirSync
    );
    mockFs.statSync.mockImplementation((pathArg: fs.PathLike) => {
      const pathStr = pathArg.toString();
      if (pathStr.endsWith('.txt')) return { isFile: () => true, size: 5 } as fs.Stats;
      return { isFile: () => false, size: 0 } as fs.Stats;
    });
    const result = processFiles('/mixed');
    expect(result).toEqual({
      id: '/mixed',
      name: 'root',
      children: [
        { id: '/mixed/file.txt', name: 'file.txt', size: 5, key: '/mixed/file.txt' },
        {
          id: '/mixed/sub',
          name: 'sub',
          children: [
            { id: '/mixed/sub/inner.txt', name: 'inner.txt', size: 5, key: '/mixed/sub/inner.txt' },
          ],
          size: 5,
          key: '/mixed/sub',
        },
      ],
      size: 10,
      key: '/mixed',
    });
  });
});
