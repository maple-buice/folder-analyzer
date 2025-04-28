import "./index.css";
import React, { useState } from 'react';
import { Treemap } from 'recharts';

const App = () => {
  const [folderData, setFolderData] = useState<any>(null);
  const [currentPath, setCurrentPath] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<string>('/Users/mbuice/src/FolderAnalyzer/test/unified-theme');

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFolderPath(event.target.value);
  };

  const handleSubmit = () => {
    if (folderPath) {
      sendFolderPathToBackend(folderPath);
    }
  };

  const sendFolderPathToBackend = async (path: string) => {
    try {
      const encodedPath = encodeURIComponent(path);
      const response = await fetch(`/api/analyze-folder/${encodedPath}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json().catch(() => ({ message: 'No data received' }));
      console.log(data);
      if (data.tree) {
        setFolderData(data.tree);
      }
    } catch (error) {
      console.error('Error sending folder path:', error);
    }
  };

  const processFiles = (files: FileList): any => {
    const fileMap: any = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pathParts = file.webkitRelativePath.split('/');
      let currentLevel = fileMap;

      pathParts.forEach((part: string, index: number) => {
        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            children: index === pathParts.length - 1 ? null : {},
            size: index === pathParts.length - 1 ? file.size : 0,
          };
        }
        if (index === pathParts.length - 1) {
          currentLevel[part].size = file.size;
        }
        currentLevel = currentLevel[part].children;
      });
    }

    const buildTree = (node: any): any => {
      if (!node.children) return node;
      const children = Object.values(node.children).map(buildTree);
      const size = children.reduce((acc: number, child: any) => acc + child.size, 0);
      return { ...node, children, size };
    };

    return buildTree({ name: 'root', children: fileMap });
  };

  const handleNodeClick = (node: any) => {
    if (node.children) {
      setCurrentPath(node.name);
      setFolderData(node);
    }
  };

  // Transform backend tree to recharts format
  function toRechartsTree(node: any): any {
    let children = node.children;
    if (children && !Array.isArray(children)) {
      children = Object.values(children).map(toRechartsTree);
    }
    if (Array.isArray(children) && children.length === 0) {
      children = undefined;
    }
    // Omit key for recharts
    const { key, ...rest } = node;
    return { ...rest, children };
  }

  console.log('Folder Data:', folderData);

  return (
    <div className="App p-4">
      <h1 className="text-2xl font-bold mb-4">Folder Treemap</h1>
      <div className="mb-4">
        <input
          type="text"
          value={folderPath}
          onChange={handleInputChange}
          placeholder="Enter folder path"
          className="border border-gray-300 p-2 rounded w-full mb-2"
        />
        <button
          onClick={handleSubmit}
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Analyze Folder
        </button>
      </div>
      <p className="mb-4">Selected Folder: {folderPath}</p>
      {folderData && (
        <Treemap
          width={800}
          height={600}
          data={[toRechartsTree(folderData)]}
          dataKey="size"
          stroke="#fff"
          fill="#8884d8"
        />
      )}
    </div>
  );
};

export default App;
