import { processDirectory } from './fileProcessor';
import { TreeNode } from '../types';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'; // Import bun:test functions

// Define a base temporary directory for this test suite
const testDirBase = path.join(os.tmpdir(), `folderAnalyzer-tests-${Date.now()}`);

// Paths for different test scenarios
const emptyDirPath = path.join(testDirBase, 'emptyDir');
const filesOnlyPath = path.join(testDirBase, 'filesOnly');
const nestedPath = path.join(testDirBase, 'nested');
const nestedSubdirPath = path.join(nestedPath, 'subdir');
const excludedPath = path.join(testDirBase, 'excluded');
const excludedNodeModulesPath = path.join(excludedPath, 'node_modules');
const linksPath = path.join(testDirBase, 'links');
const linkFilePath = path.join(linksPath, 'a_link');
const linkTargetFilePath = path.join(linksPath, 'target_file.txt');
// Note: Testing permission errors reliably cross-platform is difficult, skipping specific permission test

describe('processDirectory - Integration with Temporary Files', () => {
  beforeAll(async () => {
    // Create the base directory and scenario subdirectories
    await fsPromises.mkdir(testDirBase, { recursive: true });
    await fsPromises.mkdir(emptyDirPath, { recursive: true });
    await fsPromises.mkdir(filesOnlyPath, { recursive: true });
    await fsPromises.mkdir(nestedPath, { recursive: true });
    await fsPromises.mkdir(nestedSubdirPath, { recursive: true });
    await fsPromises.mkdir(excludedPath, { recursive: true });
    await fsPromises.mkdir(excludedNodeModulesPath, { recursive: true }); // Dir to be excluded
    await fsPromises.mkdir(linksPath, { recursive: true });

    // Populate directories with files
    // filesOnly:
    await fsPromises.writeFile(path.join(filesOnlyPath, 'file1.txt'), 'content100'); // 10 bytes
    await fsPromises.writeFile(path.join(filesOnlyPath, 'file2.js'), 'content20000'); // 12 bytes
    // nested:
    await fsPromises.writeFile(path.join(nestedPath, 'file1.txt'), 'nes50'); // 5 bytes
    await fsPromises.writeFile(path.join(nestedSubdirPath, 'file2.log'), 'logcontent150bytes'); // 18 bytes
    // excluded:
    await fsPromises.writeFile(path.join(excludedPath, 'config.json'), '{\"a\":1}'); // 7 bytes
    await fsPromises.writeFile(path.join(excludedNodeModulesPath, 'some_dep.js'), 'ignore me'); // Should be ignored due to exclusion
    // links:
    await fsPromises.writeFile(path.join(linksPath, 'a_file.dat'), 'actual_data_123'); // 15 bytes
    await fsPromises.writeFile(linkTargetFilePath, 'link_target'); // Target file
    // Create symlink (skip on windows maybe? Symlinks can require special permissions)
    try {
      await fsPromises.symlink(linkTargetFilePath, linkFilePath, 'file');
    } catch (err) {
      console.warn(`Could not create symlink for tests (common on Windows without admin): ${err}`);
      // Test for symlinks might be unreliable if creation fails
    }
  });

  afterAll(async () => {
    // Clean up the temporary directory
    await fsPromises.rm(testDirBase, { recursive: true, force: true });
  });

  it('should return an empty structure for an empty directory', async () => {
    const result = await processDirectory(emptyDirPath);

    expect(result.node).toEqual<TreeNode>({
      id: emptyDirPath,
      key: emptyDirPath,
      name: 'emptyDir',
      size: 0,
      children: [],
      // No processingErrors expected here
    });
    expect(result.size).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('should process a directory with only files and calculate size', async () => {
    const result = await processDirectory(filesOnlyPath);

    expect(result.size).toBe(10 + 12); // 22 bytes
    expect(result.node.size).toBe(22);
    expect(result.node.children).toHaveLength(2);
    expect(result.node.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'file1.txt', size: 10 }),
        expect.objectContaining({ name: 'file2.js', size: 12 }),
      ])
    );
    expect(result.errors).toEqual([]);
  });

  it('should recursively process subdirectories and sum sizes', async () => {
    const result = await processDirectory(nestedPath);

    expect(result.size).toBe(5 + 18); // 23 bytes
    expect(result.node.size).toBe(23);
    expect(result.node.children).toHaveLength(2);

    const file1Node = result.node.children?.find((c) => c.name === 'file1.txt');
    const subdirNode = result.node.children?.find((c) => c.name === 'subdir');

    expect(file1Node).toBeDefined();
    expect(file1Node?.size).toBe(5);

    expect(subdirNode).toBeDefined();
    expect(subdirNode?.size).toBe(18); // Size of subdir content
    expect(subdirNode?.children).toHaveLength(1);
    expect(subdirNode?.children?.[0]?.name).toBe('file2.log');
    expect(subdirNode?.children?.[0]?.size).toBe(18);
    expect(result.errors).toEqual([]);
  });

  it('should skip excluded directories and their content', async () => {
    const result = await processDirectory(excludedPath, ['node_modules']);

    expect(result.size).toBe(7); // Only config.json size
    expect(result.node.size).toBe(7);
    expect(result.node.children).toHaveLength(1);
    expect(result.node.children?.find((c) => c.name === 'node_modules')).toBeUndefined();
    expect(result.node.children?.find((c) => c.name === 'config.json')).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  it('should report errors for non-existent paths', async () => {
    const nonExistentPath = path.join(testDirBase, 'does_not_exist');
    const result = await processDirectory(nonExistentPath);

    expect(result.size).toBe(0);
    expect(result.node.size).toBe(0);
    expect(result.node.children).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(`Error reading directory ${nonExistentPath}`);
    expect(result.errors[0]).toContain('ENOENT');
    // Check node processingErrors - should be undefined as the node itself wasn't processed deeply
    expect(result.node.processingErrors).toBeUndefined();
  });

  it('should not follow symbolic links and exclude them from size', async () => {
    // Check if symlink was created before running the test
    let symlinkExists = false;
    try {
      await fsPromises.lstat(linkFilePath);
      symlinkExists = true;
    } catch {}

    if (!symlinkExists) {
      console.warn('Skipping symlink test because link could not be created.');
      return; // Skip test if link setup failed
    }

    const result = await processDirectory(linksPath);

    expect(result.size).toBe(15 + 11); // a_file.dat (15) + target_file.txt (11)
    expect(result.node.size).toBe(26);
    expect(result.node.children).toHaveLength(2); // Contains file and target, excludes link
    expect(result.node.children?.find((c) => c.name === 'a_file.dat')).toBeDefined();
    expect(result.node.children?.find((c) => c.name === 'target_file.txt')).toBeDefined(); // Target file IS included
    expect(result.node.children?.find((c) => c.name === 'a_link')).toBeUndefined(); // Link itself is excluded
    expect(result.errors).toEqual([]);
    expect(result.node.processingErrors).toBeUndefined(); // No errors expected
  });

  // Note: Skipping permission error test as it's hard to guarantee setup cross-platform.
});
