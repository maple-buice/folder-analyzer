import "./index.css";
import React, { useState, useEffect } from 'react';
import { ResponsiveTreeMap } from "@nivo/treemap";

const App = () => {
  const [folderPath, setFolderPath] = useState<string>("/Users/mbuice/src/FolderAnalyzer/test/unified-theme");
  const [folderData, setFolderData] = useState<any>(null);
  const [nivoData, setNivoData] = useState<any>(null);
  const [nodeStack, setNodeStack] = useState<any[]>([]);

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
      if (data.tree) {
        setFolderData(data.tree);
        const nivoTree = toNivoTree(data.tree);
        setNivoData(nivoTree);
        setNodeStack([nivoTree]);
      }
    } catch (error) {
      console.error('Error sending folder path:', error);
    }
  };

  const handleClick = (node: any) => {
    if (node.data.children) {
      setNodeStack([...nodeStack, node.data]);
    }
  };

  const handleBack = () => {
    if (nodeStack.length > 1) {
      setNodeStack(nodeStack.slice(0, -1));
    }
  };

  const currentRoot = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : nivoData;

  // Convert backend TreeNode to Nivo format
  function toNivoTree(node: any): any {
    if (node.children && node.children.length > 0) {
      return {
        name: node.name,
        children: node.children.map(toNivoTree),
      };
    }
    return {
      name: node.name,
      value: node.size ?? 1,
    };
  }

  return (
    <div style={{ padding: 24, height: "100vh", width: "100vw" }}>
      <h1>Nivo Treemap Drilldown</h1>
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
      <p className="mb-2 text-sm text-gray-400">
        Drilldown enabled. Click a folder to zoom in. Use Back to zoom out.
      </p>
      {nodeStack.length > 1 && (
        <button onClick={handleBack} style={{ marginBottom: 8 }}>
          Back
        </button>
      )}
      <div style={{ height: "80vh", width: "100%" }}>
        {currentRoot && (
          <ResponsiveTreeMap
            data={currentRoot}
            identity="name"
            value="value"
            label="name"
            labelSkipSize={12}
            parentLabelPosition="left"
            colors={{ scheme: "nivo" }}
            borderColor={{ from: "color", modifiers: [["darker", 0.3]] }}
            animate={true}
            motionConfig="gentle"
            onClick={handleClick}
          />
        )}
      </div>
    </div>
  );
};

export default App;
