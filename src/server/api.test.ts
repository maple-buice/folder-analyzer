import { handleAnalyzeFolder } from './api'; // Import the specific handler
import { processDirectory } from './fileProcessor';
import { TreeNode, ApiResponse } from '../types';
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import fsPromises from 'fs/promises';

// Define sample data first
const testPath = '/test/path';
const sampleTree: TreeNode = {
  id: testPath,
  name: 'path',
  size: 100,
  children: [{ id: `${testPath}/file.txt`, name: 'file.txt', size: 100 }],
};
const baseProcessDirResult = { node: sampleTree, errors: [], size: sampleTree.size };

// Mock the fileProcessor module
mock.module('./fileProcessor', () => ({
  // Mock processDirectory to return the correct structure by default
  processDirectory: mock(async () => baseProcessDirResult),
}));

// Type cast the mocked function
const mockedProcessDirectory = processDirectory as ReturnType<typeof mock<typeof processDirectory>>;

// Define spy for fs.stat
let statSpy: ReturnType<typeof spyOn>;

// Helper to create mock fs.Stats objects
const createMockStat = (isDirectory: boolean): Partial<import('fs').Stats> => ({
  isDirectory: () => isDirectory,
});

describe('API Handler: handleAnalyzeFolder', () => {
  beforeEach(() => {
    mockedProcessDirectory.mockClear();
    // Create spy on fsPromises.stat and set default implementation
    statSpy = spyOn(fsPromises, 'stat');
    statSpy.mockResolvedValue(createMockStat(true) as unknown); // Default to existing directory
  });

  // Helper to create a mock Request object for a specific API path
  const createApiRequest = (
    folderPath: string,
    searchParams: Record<string, string> = {}
  ): Request => {
    const encodedPath = encodeURIComponent(folderPath);
    const url = new URL(`http://localhost:3001/api/analyze-folder/${encodedPath}`);
    Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));
    return new Request(url.toString());
  };

  it('should return 200 and tree data on successful processing', async () => {
    mockedProcessDirectory.mockResolvedValueOnce(baseProcessDirResult);
    const request = createApiRequest(testPath);

    const response = await handleAnalyzeFolder(request);
    const body: ApiResponse = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Analysis successful');
    expect(body.tree).toEqual(sampleTree); // Expect the node itself
    expect(body.errors).toEqual([]);
    expect(mockedProcessDirectory).toHaveBeenCalledWith(testPath, []);
    expect(statSpy).toHaveBeenCalledWith(testPath);
  });

  it('should handle exclusions query parameter', async () => {
    mockedProcessDirectory.mockResolvedValueOnce(baseProcessDirResult);
    const exclusions = 'node_modules,.git';
    const request = createApiRequest(testPath, { exclude: exclusions });

    const response = await handleAnalyzeFolder(request);

    expect(response.status).toBe(200);
    // Check that processDirectory was called with parsed exclusions
    expect(mockedProcessDirectory).toHaveBeenCalledWith(testPath, ['node_modules', '.git']);
  });

  it('should return 200 with tree and errors if processDirectory returns errors', async () => {
    const processingErrors = ['Error reading file X', 'Error reading dir Y'];
    const treeWithErrors: TreeNode = {
      ...sampleTree,
      processingErrors: processingErrors, // The node might have errors attached too
    };
    mockedProcessDirectory.mockResolvedValueOnce({
      node: treeWithErrors,
      errors: processingErrors, // Ensure errors are in the correct place
      size: treeWithErrors.size,
    });
    const request = createApiRequest(testPath);

    const response = await handleAnalyzeFolder(request);
    const body: ApiResponse = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Analysis successful');
    expect(body.tree).toEqual(treeWithErrors); // Should still return the tree node
    expect(body.errors).toEqual(processingErrors); // Errors should be in the response errors array
    expect(mockedProcessDirectory).toHaveBeenCalledWith(testPath, []);
  });

  it('should return 404 if folder does not exist (fs.stat throws ENOENT)', async () => {
    const error = new Error('Not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    statSpy.mockRejectedValueOnce(error);
    const request = createApiRequest(testPath);

    const response = await handleAnalyzeFolder(request);
    const body: ApiResponse = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe('Folder does not exist');
    expect(body.tree).toBeNull();
    expect(mockedProcessDirectory).not.toHaveBeenCalled();
    expect(statSpy).toHaveBeenCalledWith(testPath);
  });

  it('should return 403 if folder access denied (fs.stat throws EACCES)', async () => {
    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    statSpy.mockRejectedValueOnce(error);
    const request = createApiRequest(testPath);

    const response = await handleAnalyzeFolder(request);
    const body: ApiResponse = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe(`Permission denied accessing folder: ${testPath}`);
    expect(body.tree).toBeNull();
    expect(mockedProcessDirectory).not.toHaveBeenCalled();
    expect(statSpy).toHaveBeenCalledWith(testPath);
  });

  it('should return 400 if path is not a directory', async () => {
    statSpy.mockResolvedValueOnce(createMockStat(false) as unknown);
    const request = createApiRequest(testPath);

    const response = await handleAnalyzeFolder(request);
    const body: ApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe('Path is not a directory');
    expect(body.tree).toBeNull();
    expect(mockedProcessDirectory).not.toHaveBeenCalled();
    expect(statSpy).toHaveBeenCalledWith(testPath);
  });

  it('should return 500 if processDirectory throws an unexpected error', async () => {
    const errorMessage = 'Unexpected processing error!';
    mockedProcessDirectory.mockRejectedValueOnce(new Error(errorMessage));
    const request = createApiRequest(testPath);

    const response = await handleAnalyzeFolder(request);
    const body: ApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe(`Error analyzing folder: ${errorMessage}`);
    expect(body.tree).toBeNull();
    expect(body.errors).toEqual([`Error analyzing folder: ${errorMessage}`]);
    expect(mockedProcessDirectory).toHaveBeenCalledWith(testPath, []);
    expect(statSpy).toHaveBeenCalledWith(testPath); // Stat is checked before processDirectory
  });

  it('should return 400 if path parameter is missing', async () => {
    // Create a request where the path split results in empty string
    const request = new Request('http://localhost:3001/api/analyze-folder/');

    const response = await handleAnalyzeFolder(request);
    const body: ApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe('Folder path parameter is missing');
    expect(body.tree).toBeNull();

    // Explicitly clear spy calls just before assertion for this specific test case
    // to ensure we only check calls within this test, potentially working around
    // unexpected spy behavior.
    statSpy.mockClear();

    expect(statSpy).not.toHaveBeenCalled();
    expect(mockedProcessDirectory).not.toHaveBeenCalled();
  });
});
