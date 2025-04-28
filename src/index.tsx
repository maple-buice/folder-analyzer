import { serve } from "bun";
import index from "./index.html";
import fs from 'fs';
import path from 'path';

export type TreeNode = {
  name: string;
  children?: TreeNode[]; // always array for folders, omitted for files
  size: number;
  key: string;
};

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    "/api/analyze-folder/:path": async (req: { params: { path: string } }) => {
      const folderPath = req.params.path;

      const fileMap = processFiles(folderPath);
      const tree: TreeNode = { name: 'root', children: fileMap.children, size: fileMap.size || 0, key: 'root' };
      if (fileMap.size === undefined) {
        const calculateSize = (node: TreeNode): number => {
          if (!node.children) return node.size || 0;
          const children = Object.values(node.children);
          const size = children.reduce((acc: number, child: TreeNode) => acc + calculateSize(child), 0);
          node.size = size;
          return size;
        };
        calculateSize(tree);
      }

      return Response.json({ message: 'Folder analysis complete', tree });
    },
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 Server running at ${server.url}`);

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log('[DIAGNOSTIC]', ...args);
}

export const processFiles = (folderPath: string): TreeNode => {
  const fileMap: TreeNode[] = [];
  const files = fs.readdirSync(folderPath);

  files.forEach((file) => {
    const fileName = typeof file === 'string' ? file : String(file);
    const filePath = path.join(folderPath, fileName);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      fileMap.push({
        name: fileName,
        size: stats.size,
        key: filePath,
        // omit children for files
      });
    } else {
      // Directory: recurse
      const childTree = processFiles(filePath);
      fileMap.push({
        name: fileName,
        children: childTree.children || [], // always array for folders
        size: 0, // will be calculated
        key: filePath,
      });
    }
  });

  // Always use 'root' for the root node's name and key to match test expectation
  const root: TreeNode = {
    name: 'root',
    children: fileMap, // always array for folders
    size: 0,
    key: 'root',
  };
  calculateSize(root);
  return root;
};

export const calculateSize = (node: TreeNode): number => {
  if (!node.children) return node.size || 0;
  // Folder node
  const size = node.children.reduce((acc: number, child: TreeNode) => acc + calculateSize(child), 0);
  node.size = size;
  return size;
};
