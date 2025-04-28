import { serve } from "bun";
import index from "./index.html";
import fs from 'fs';
import path from 'path';

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

    "/api/analyze-folder/:path": async (req) => {
      const folderPath = req.params.path;

      const processFiles = (folderPath: string) => {
        const fileMap: any = {};
        const files = fs.readdirSync(folderPath);

        files.forEach((file) => {
          const filePath = path.join(folderPath, file);
          const stats = fs.statSync(filePath);

          const relativePath = path.relative(folderPath, filePath);
          const pathParts = relativePath.split(path.sep);
          let currentLevel = fileMap;

          pathParts.forEach((part, index) => {
            if (!currentLevel[part]) {
              currentLevel[part] = {
                name: part,
                children: index === pathParts.length - 1 ? null : {},
                size: index === pathParts.length - 1 ? stats.size : 0,
              };
            }
            if (index === pathParts.length - 1) {
              currentLevel[part].size = stats.size;
            }
            currentLevel = currentLevel[part].children;
          });
        });

        return fileMap;
      };

      const buildTree = (node: any): any => {
        if (!node.children) return node;
        const children = Object.values(node.children).map(buildTree);
        const size = children.reduce((acc: number, child: any) => acc + child.size, 0);
        return { ...node, children, size };
      };

      const fileMap = processFiles(folderPath);
      const tree = buildTree({ name: 'root', children: fileMap });

      return Response.json({ message: 'Folder analysis complete', tree });
    },
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 Server running at ${server.url}`);
