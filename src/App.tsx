import './index.css';
import React, { useState, useMemo } from 'react';
import { ResponsiveSunburst } from '@nivo/sunburst';

const App = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [folderData, setFolderData] = useState<any>(null);
  const [nivoData, setNivoData] = useState<any>(null);
  const [nodeStack, setNodeStack] = useState<any[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [appliedFilter, setAppliedFilter] = useState<string>('');
  const [extensionFilter, setExtensionFilter] = useState<string>('');
  const [appliedExtension, setAppliedExtension] = useState<string>('');

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
    () => filterTree(currentRoot, appliedFilter, appliedExtension, true),
    [currentRoot, appliedFilter, appliedExtension]
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

  function filterTree(node: any, search: string, ext: string, isRoot = false): any | null {
    if (!node) return null;
    const searchLower = search ? search.toLowerCase() : '';
    const extLower = ext ? (ext.startsWith('.') ? ext.toLowerCase() : '.' + ext.toLowerCase()) : '';
    const matchesText =
      !searchLower ||
      node.name.toLowerCase().includes(searchLower) ||
      node.id.toLowerCase().includes(searchLower);
    const matchesExt =
      !extLower || (node.children ? false : node.name.toLowerCase().endsWith(extLower));
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map((child: any) => filterTree(child, search, ext, false))
        .filter(Boolean);
      if (filteredChildren.length > 0 || (matchesText && matchesExt)) {
        const totalValue = filteredChildren.reduce(
          (acc: number, child: any) => acc + (child.value ?? 0),
          0
        );
        const result: any = { ...node, children: filteredChildren };
        if (!isRoot) result.value = totalValue;
        return result;
      }
      return null;
    }
    return matchesText && matchesExt ? node : null;
  }

  // Extract unique file extensions from the current tree
  function getExtensionsFromTree(node: any, extensions = new Set<string>()): Set<string> {
    if (!node) return extensions;
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => getExtensionsFromTree(child, extensions));
    } else if (node.name && node.name.includes('.')) {
      const ext = node.name.slice(node.name.lastIndexOf('.')).toLowerCase();
      extensions.add(ext);
    }
    return extensions;
  }
  const extensionOptions = Array.from(getExtensionsFromTree(currentRoot)).sort();

  return (
    <div style={{ padding: 24, height: '100vh', width: '100vw' }}>
      <header className="mb-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight drop-shadow-lg">
          Folder Sunburst Explorer
        </h1>
        <p className="text-gray-300 mb-4 text-center max-w-xl">
          Instantly visualize your disk usage. Analyze any folder, then filter and drill down to
          find large files and folders fast.
        </p>
      </header>
      <div className="max-w-2xl mx-auto bg-[#23272f] bg-opacity-80 rounded-xl shadow-lg p-6 mb-8 flex flex-col gap-4">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={folderPath}
            onChange={handleInputChange}
            placeholder="Enter a folder path..."
            className="border border-gray-300 p-2 rounded flex-1 min-w-0"
          />
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 min-w-[140px]"
          >
            Analyze Folder
          </button>
        </div>
        {folderData && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedFilter(searchText);
              setAppliedExtension(extensionFilter);
            }}
            className="flex gap-2 items-center"
          >
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search files or folders"
              className="border border-gray-300 p-2 rounded flex-1 min-w-0"
            />
            <select
              value={extensionFilter}
              onChange={(e) => setExtensionFilter(e.target.value)}
              className="border border-gray-300 p-2 rounded w-48"
            >
              <option value="">All Extensions</option>
              {extensionOptions.map((ext) => (
                <option key={ext} value={ext}>
                  {ext}
                </option>
              ))}
            </select>
            <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
              Filter
            </button>
            <button
              type="button"
              className="bg-gray-300 text-black p-2 rounded hover:bg-gray-400"
              onClick={() => {
                setSearchText('');
                setAppliedFilter('');
                setExtensionFilter('');
                setAppliedExtension('');
              }}
            >
              Clear
            </button>
          </form>
        )}
      </div>
      <div className="max-w-2xl mx-auto mb-4">
        <div className="bg-blue-100 bg-opacity-80 text-blue-900 text-sm rounded-lg px-4 py-3 flex items-center gap-2 shadow-sm">
          <svg
            className="w-4 h-4 text-blue-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
          </svg>
          <span>
            <strong>Drilldown enabled:</strong> Click a folder to zoom in. Use <b>Back</b> to zoom
            out.
          </span>
        </div>
      </div>
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
