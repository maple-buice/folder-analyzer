import "./index.css";
import React, { useState, useEffect } from 'react';
import { ResponsiveSunburst } from "@nivo/sunburst";

const App = () => {
  const [folderPath, setFolderPath] = useState<string>("/Users/mbuice/src/FolderAnalyzer/test/unified-theme");
  const [folderData, setFolderData] = useState<any>(null);
  const [nivoData, setNivoData] = useState<any>(null);
  const [nodeStack, setNodeStack] = useState<any[]>([]);

  // Path prefix to remove
  const PATH_PREFIX = '/Users/mbuice/src/FolderAnalyzer/test';

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
        const nivoTree = toNivoTree(data.tree, true);
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
  function toNivoTree(node: any, isRoot = false): any {
    if (node.children && node.children.length > 0) {
      const children = node.children.map((child: any) => toNivoTree(child, false));
      const totalValue = children.reduce((acc: number, child: any) => acc + (child.value ?? 0), 0);
      const result: any = {
        id: node.key,
        name: node.name,
        children,
      };
      if (!isRoot) {
        result.value = totalValue;
      }
      return result;
    }
    return {
      id: node.key,
      name: node.name,
      value: node.size ?? 1,
    };
  }

  // Helper to format bytes as kilobytes or megabytes with 2 decimal points
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  // Custom tooltip for Nivo Sunburst
  const SunburstTooltip = (node: any) => {
    const displayPath = node.id.startsWith(PATH_PREFIX) ? node.id.slice(PATH_PREFIX.length) : node.id;
    return (
      <div
        style={{
          background: 'white',
          color: 'black',
          padding: '6px 9px',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 14,
          pointerEvents: 'none',
        }}
      >
        <strong>{node.data.name}</strong>
        <br />
        <span>({formatSize(node.data.value)})</span>
        <div style={{ fontSize: 12, color: '#888' }}>{displayPath}</div>
      </div>
    );
  };

  // Arc label: show name and size (with line break) for both files and folders
  const arcLabel = (d: any) => {
    const displayPath = d.id.startsWith(PATH_PREFIX) ? d.id.slice(PATH_PREFIX.length) : d.id;
    return `${d.data.name}\n(${formatSize(d.data.value)})`;
    // If you want to use the path in the label, you could add it here as well
    // return `${d.data.name}\n(${formatSize(d.data.value)})\n${displayPath}`;
  };

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
          <ResponsiveSunburst
            data={currentRoot}
            value="value"
            cornerRadius={2}
            borderColor={{ from: "color", modifiers: [["darker", 0.6]] }}
            colors={{ scheme: "nivo" }}
            childColor={{ from: "color" }}
            animate={true}
            motionConfig="gentle"
            onClick={handleClick}
            tooltip={SunburstTooltip}
            enableArcLabels={true}
            arcLabel={arcLabel}
            arcLabelsSkipAngle={20}
            arcLabelsRadiusOffset={0.8}
            arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
          />
        )}
      </div>
    </div>
  );
};

export default App;
