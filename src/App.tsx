import './index.css';
import React, { useState, useMemo } from 'react';
import { ResponsiveSunburst } from '@nivo/sunburst';

const App = () => {
  const [folderPath, setFolderPath] = useState<string>(
    '/Users/mbuice/src/FolderAnalyzer/test/unified-theme'
  );
  const [folderData, setFolderData] = useState<any>(null);
  const [nivoData, setNivoData] = useState<any>(null);
  const [nodeStack, setNodeStack] = useState<any[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [appliedFilter, setAppliedFilter] = useState<string>('');

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
        headers: { 'Content-Type': 'application/json' },
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
  const filteredRoot = useMemo(
    () => filterTree(currentRoot, appliedFilter),
    [currentRoot, appliedFilter]
  );

  function toNivoTree(node: any, isRoot = false): any {
    if (node.children && node.children.length > 0) {
      const children = node.children.map((child: any) => toNivoTree(child, false));
      const totalValue = children.reduce((acc: number, child: any) => acc + (child.value ?? 0), 0);
      const result: any = { id: node.key, name: node.name, children };
      if (!isRoot) result.value = totalValue;
      return result;
    }
    return { id: node.key, name: node.name, value: node.size ?? 1 };
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  // Dynamically compute the prefix to remove from paths based on the analyzed folder
  const getDisplayPath = (fullPath: string) => {
    if (!folderPath) return fullPath;
    // Ensure trailing slash for correct matching
    const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath;
  };

  const SunburstTooltip = (node: any) => {
    const displayPath = getDisplayPath(node.id);
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

  const arcLabel = (d: any) => {
    // Optionally use displayPath in the label if desired
    return `${d.data.name}\n(${formatSize(d.data.value)})`;
    // Or: return `${d.data.name}\n(${formatSize(d.data.value)})\n${getDisplayPath(d.id)}`;
  };

  function filterTree(node: any, search: string): any | null {
    if (!node) return null;
    if (!search) return node;
    const searchLower = search.toLowerCase();
    const matches =
      node.name.toLowerCase().includes(searchLower) || node.id.toLowerCase().includes(searchLower);
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map((child: any) => filterTree(child, search))
        .filter(Boolean);
      if (filteredChildren.length > 0 || matches) {
        const totalValue = filteredChildren.reduce(
          (acc: number, child: any) => acc + (child.value ?? 0),
          0
        );
        return { ...node, children: filteredChildren, value: totalValue };
      }
      return null;
    }
    return matches ? node : null;
  }

  return (
    <div style={{ padding: 24, height: '100vh', width: '100vw' }}>
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
      {folderData && (
        <div className="mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedFilter(searchText);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search files or folders"
              className="border border-gray-300 p-2 rounded w-full mb-2"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 mb-2"
            >
              Filter
            </button>
            <button
              type="button"
              className="bg-gray-300 text-black p-2 rounded hover:bg-gray-400 mb-2"
              onClick={() => {
                setSearchText('');
                setAppliedFilter('');
              }}
            >
              Clear
            </button>
          </form>
        </div>
      )}
      <p className="mb-2 text-sm text-gray-400">
        Drilldown enabled. Click a folder to zoom in. Use Back to zoom out.
      </p>
      {nodeStack.length > 1 && (
        <button onClick={handleBack} style={{ marginBottom: 8 }}>
          Back
        </button>
      )}
      <div style={{ height: '80vh', width: '100%' }}>
        {filteredRoot && (
          <ResponsiveSunburst
            data={filteredRoot}
            value="value"
            cornerRadius={2}
            borderColor={{ from: 'color', modifiers: [['darker', 0.6]] }}
            colors={{ scheme: 'nivo' }}
            childColor={{ from: 'color' }}
            animate={true}
            motionConfig="gentle"
            onClick={handleClick}
            tooltip={SunburstTooltip}
            enableArcLabels={true}
            arcLabel={arcLabel}
            arcLabelsSkipAngle={10}
            arcLabelsRadiusOffset={0.8}
            arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
          />
        )}
      </div>
    </div>
  );
};

export default App;
