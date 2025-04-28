import { serve } from 'bun';
import index from './index.html';
import fs from 'fs';
import path from 'path';
import { TreeNode, ApiResponse } from './types';
import { calculateSize } from './utils/tree';

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    '/*': index,

    '/api/analyze-folder/:path': async (req: { params: { path: string } }) => {
      const folderPath = req.params.path;
      try {
        if (!fs.existsSync(folderPath)) {
          return Response.json({ message: 'Folder does not exist', tree: null }, { status: 404 });
        }
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) {
          return Response.json({ message: 'Path is not a directory', tree: null }, { status: 400 });
        }
        const tree = processFiles(folderPath);
        return Response.json({ message: 'Folder analysis complete', tree } satisfies ApiResponse);
      } catch (err: any) {
        return Response.json(
          { message: 'Error analyzing folder: ' + err.message, tree: null },
          { status: 500 }
        );
      }
    },
  },
  development: process.env.NODE_ENV !== 'production',
});

console.log(`🚀 Folder Sunburst Explorer server running at ${server.url}`);

export const processFiles = (folderPath: string): TreeNode => {
  const fileMap: TreeNode[] = [];
  const files = fs.readdirSync(folderPath);

  files.forEach((file) => {
    const fileName = typeof file === 'string' ? file : String(file);
    const filePath = path.join(folderPath, fileName);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      fileMap.push({
        id: filePath,
        name: fileName,
        size: stats.size,
        key: filePath,
      });
    } else {
      // Directory: recurse
      const childTree = processFiles(filePath);
      fileMap.push({
        id: filePath,
        name: fileName,
        children: childTree.children || [],
        size: 0, // will be calculated
        key: filePath,
      });
    }
  });

  // Use the full folderPath as the id/key for the root node
  const root: TreeNode = {
    id: folderPath,
    name: 'root',
    children: fileMap,
    size: 0,
    key: folderPath,
  };
  calculateSize(root);
  return root;
};
