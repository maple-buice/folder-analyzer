import './index.css';
import React, { useState, useMemo, memo, useCallback } from 'react';
import { ResponsiveSunburst } from '@nivo/sunburst';
import { TreeNode, ApiResponse } from './types';

// --- Constants ---
const VALUE_KEY = 'value';

// --- Import Utilities ---
import { formatSize } from './utils/formatting';
import { getDisplayPath, getExtensionsFromTree, toNivoTree } from './utils/treeUtils';
import { filterTree, getFilteredOutTree } from './utils/filterUtils';

// --- Components ---
const FolderInput: React.FC<{
  folderPath: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}> = ({ folderPath, onChange, onSubmit, loading }) => (
  <div className="flex gap-2 items-center w-full">
    <input
      type="text"
      value={folderPath}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter a folder path..."
      className="flex-1 min-w-0 border border-gray-700/50 bg-gray-900/50 text-gray-100 p-2 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent placeholder-gray-500"
      aria-label="Folder path"
      disabled={loading}
    />
    <button
      onClick={onSubmit}
      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!folderPath || loading}
      aria-label="Analyze folder"
    >
      {loading ? 'Analyzing...' : 'Analyze Folder'}
    </button>
  </div>
);

const FilterBar: React.FC<{
  searchText: string;
  setSearchText: (v: string) => void;
  extensionFilter: string;
  setExtensionFilter: (v: string) => void;
  extensionOptions: string[];
  onFilter: () => void;
  onClear: () => void;
  loading: boolean;
}> = ({
  searchText,
  setSearchText,
  extensionFilter,
  setExtensionFilter,
  extensionOptions,
  onFilter,
  onClear,
  loading,
}) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onFilter();
    }}
    className="flex flex-col gap-4"
    aria-label="Filter files and folders"
  >
    <div className="flex gap-2 items-center">
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search files or folders"
        className="flex-1 min-w-0 border border-gray-700/50 bg-gray-900/50 text-gray-100 p-2 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent placeholder-gray-500"
        aria-label="Search files or folders"
        disabled={loading}
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        disabled={loading}
      >
        Filter
      </button>
      <button
        type="button"
        className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700/50 whitespace-nowrap"
        onClick={onClear}
        disabled={loading}
      >
        Clear
      </button>
    </div>
    <select
      value={extensionFilter}
      onChange={(e) => setExtensionFilter(e.target.value)}
      className="w-full border border-gray-700/50 bg-gray-900/50 text-gray-100 p-2 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
      aria-label="Filter by extension"
      disabled={loading}
    >
      <option value="">All Extensions</option>
      {extensionOptions.map((ext) => (
        <option key={ext} value={ext}>
          {ext}
        </option>
      ))}
    </select>
  </form>
);

const DrilldownAlert: React.FC = () => (
  <div
    className="bg-blue-950/40 text-blue-200 rounded-lg px-4 py-3 flex items-center gap-2 shadow-lg backdrop-blur-sm border border-blue-900/20"
    role="status"
    aria-live="polite"
  >
    <svg
      className="w-5 h-5 text-blue-400 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
    </svg>
    <span>
      <strong className="font-semibold">Drilldown enabled:</strong> Click a folder to zoom in. Use{' '}
      <b>Back</b> to zoom out.
    </span>
  </div>
);

const SunburstChart: React.FC<{
  data: any;
  onClick: (node: any) => void;
  arcLabel: (d: any) => string;
  tooltip: (node: any) => React.ReactNode;
}> = memo(({ data, onClick, arcLabel, tooltip }) => (
  <ResponsiveSunburst
    data={data}
    value={VALUE_KEY}
    cornerRadius={2}
    borderColor={{ from: 'color', modifiers: [['darker', 0.6]] }}
    colors={{ scheme: 'nivo' }}
    childColor={{ from: 'color' }}
    animate={true}
    motionConfig="gentle"
    onClick={onClick}
    tooltip={tooltip}
    enableArcLabels={true}
    arcLabel={arcLabel}
    arcLabelsSkipAngle={10}
    arcLabelsRadiusOffset={0.8}
    arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
  />
));

// --- Main App ---
const App: React.FC = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [folderData, setFolderData] = useState<TreeNode | null>(null);
  const [nivoData, setNivoData] = useState<any>(null);
  const [nodeStack, setNodeStack] = useState<any[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [appliedFilter, setAppliedFilter] = useState<string>('');
  const [extensionFilter, setExtensionFilter] = useState<string>('');
  const [appliedExtension, setAppliedExtension] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backendErrors, setBackendErrors] = useState<string[]>([]);

  // --- API Call ---
  const sendFolderPathToBackend = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setBackendErrors([]);
    try {
      const encodedPath = encodeURIComponent(path);
      const response = await fetch(`/api/analyze-folder/${encodedPath}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data: ApiResponse = await response.json();

      if (response.ok) {
        if (data.tree) {
          setFolderData(data.tree);
          const nivoTree = toNivoTree(data.tree, true);
          setNivoData(nivoTree);
          setNodeStack([nivoTree]);
        } else {
          setError(data.message || 'Analysis completed but no data received.');
          setFolderData(null);
          setNivoData(null);
          setNodeStack([]);
        }
        if (data.errors && data.errors.length > 0) {
          setBackendErrors(data.errors);
        }
      } else {
        setError(data.message || 'Unknown error from server');
        setFolderData(null);
        setNivoData(null);
        setNodeStack([]);
      }
    } catch (err: any) {
      setError('Error sending folder path: ' + err.message);
      setFolderData(null);
      setNivoData(null);
      setNodeStack([]);
      setBackendErrors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Drilldown & Filtering Logic Callbacks ---
  const handleFilter = useCallback(() => {
    setAppliedFilter(searchText);
    setAppliedExtension(extensionFilter);
  }, [searchText, extensionFilter]);

  const handleClearFilter = useCallback(() => {
    setSearchText('');
    setAppliedFilter('');
    setExtensionFilter('');
    setAppliedExtension('');
  }, []);

  const handleClick = useCallback((node: any) => {
    if (node.data.children && node.data.children.length > 0) {
      setNodeStack((prevStack) => [...prevStack, node.data]);
    }
  }, []);

  const handleBack = useCallback(() => {
    setNodeStack((prevStack) => {
      if (prevStack.length > 1) {
        return prevStack.slice(0, -1);
      }
      return prevStack;
    });
  }, []);

  const handleNoOpClick = useCallback(() => {}, []);

  // --- Memoized Data Calculations ---
  const currentRoot = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : nivoData;

  const filteredRoot = useMemo(
    () => filterTree(currentRoot, appliedFilter, appliedExtension, true),
    [currentRoot, appliedFilter, appliedExtension]
  );

  const filteredOutRoot = useMemo(() => {
    if (!appliedFilter && !appliedExtension) {
      return null;
    }
    return getFilteredOutTree(currentRoot, filteredRoot, true);
  }, [currentRoot, filteredRoot, appliedFilter, appliedExtension]);

  const extensionOptions = useMemo(() => {
    const sourceData = nivoData || (folderData ? toNivoTree(folderData, true) : null);
    return Array.from(getExtensionsFromTree(sourceData)).sort();
  }, [folderData, nivoData]);

  // --- Helper functions for rendering logic ---
  const isFilterActive = (): boolean => !!(appliedFilter || appliedExtension);

  // --- Tooltip and ArcLabel Callbacks ---
  const SunburstTooltip = useCallback(
    (node: any) => {
      const displayPath = getDisplayPath(node.id, folderPath);
      const sizeStr = typeof node.value === 'number' ? formatSize(node.value) : 'N/A';
      return (
        <div
          className="bg-gray-900 text-gray-100 p-3 rounded-lg shadow-xl border border-gray-800"
          aria-label={`Tooltip for ${node.data.name}`}
        >
          <strong className="block text-sm font-medium">{node.data.name}</strong>
          <span className="text-sm text-gray-400">({sizeStr})</span>
          <div className="text-xs text-gray-500 mt-1">{displayPath}</div>
        </div>
      );
    },
    [folderPath]
  );

  const arcLabel = useCallback((d: any) => {
    const sizeStr = typeof d.data.value === 'number' ? formatSize(d.data.value) : 'N/A';
    const nameStr = d.data.name || '';
    return `${nameStr}\n(${sizeStr})`;
  }, []);

  // --- Render ---
  return (
    <div className="h-screen w-screen bg-[#0B1120] text-gray-100 overflow-hidden flex flex-col">
      <header className="flex-none text-center py-4">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight drop-shadow-lg">
          Folder Sunburst Explorer
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm px-4">
          Instantly visualize your disk usage. Analyze any folder, then filter and drill down to
          find large files and folders fast.
        </p>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 p-4 pb-6 overflow-hidden">
        {/* Controls Panel */}
        <div className="lg:sticky lg:top-4 overflow-y-auto">
          <div className="bg-gray-900/40 backdrop-blur-sm rounded-xl shadow-xl p-4 space-y-4 border border-gray-800/20">
            <FolderInput
              folderPath={folderPath}
              onChange={setFolderPath}
              onSubmit={() => folderPath && sendFolderPathToBackend(folderPath)}
              loading={loading}
            />
            <FilterBar
              searchText={searchText}
              setSearchText={setSearchText}
              extensionFilter={extensionFilter}
              setExtensionFilter={setExtensionFilter}
              extensionOptions={extensionOptions}
              onFilter={handleFilter}
              onClear={handleClearFilter}
              loading={loading}
            />
            {nodeStack.length > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center bg-gray-800 text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700/50"
                aria-label="Back"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
            {error && (
              <div
                className="bg-red-950/40 text-red-200 rounded-lg px-4 py-3 border border-red-900/20"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          {folderData && (
            <div className="mt-4">
              <DrilldownAlert />
            </div>
          )}

          {backendErrors.length > 0 && (
            <div
              className="mt-4 bg-yellow-950/40 text-yellow-200 rounded-lg p-3 border border-yellow-900/30 text-xs space-y-1 overflow-y-auto max-h-32"
              role="alert"
            >
              <p className="font-semibold text-yellow-100">
                Note: Some items could not be accessed:
              </p>
              <ul className="list-disc list-inside pl-2">
                {backendErrors.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Chart Area */}
        <div className="min-h-0 bg-gray-900/40 backdrop-blur-sm rounded-xl shadow-xl border border-gray-800/20 flex flex-col overflow-hidden">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-full">
              <span className="loader" aria-label="Loading" />
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex items-center justify-center h-full text-red-400 p-4">
              Error: {error}
            </div>
          )}

          {/* Initial State (No Data) */}
          {!loading && !error && !folderData && (
            <div className="flex items-center justify-center h-full text-gray-500">
              Enter a folder path above and click "Analyze Folder" to start.
            </div>
          )}

          {/* Data Loaded State */}
          {!loading && !error && folderData && (
            <div
              className={`flex flex-1 min-h-0 ${
                isFilterActive() ? 'flex-row' : 'flex-col'
              } p-2 gap-2`}
            >
              {/* === Left Section (No Filter OR Matching Results / No Match Message) === */}
              {!isFilterActive() && currentRoot ? (
                <div className="flex-1 min-h-0">
                  <SunburstChart
                    data={currentRoot}
                    onClick={handleClick}
                    arcLabel={arcLabel}
                    tooltip={SunburstTooltip}
                  />
                </div>
              ) : isFilterActive() ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  {filteredRoot ? (
                    <>
                      <h2 className="text-center text-sm font-semibold text-gray-300 mb-1 shrink-0 h-5">
                        Matching Results
                      </h2>
                      <div className="flex-1 min-h-0">
                        <SunburstChart
                          data={filteredRoot}
                          onClick={handleClick}
                          arcLabel={arcLabel}
                          tooltip={SunburstTooltip}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 min-h-0 flex items-center justify-center text-gray-500">
                      No items match the current filter.
                    </div>
                  )}
                </div>
              ) : null}

              {/* === Right Section (Filtered Out Results) === */}
              {isFilterActive() && filteredOutRoot && (
                <div className="flex-1 min-h-0 flex flex-col">
                  {isFilterActive() && (
                    <h2 className="text-center text-sm font-semibold text-gray-400 mb-1 shrink-0 h-5">
                      Filtered Out
                    </h2>
                  )}
                  <div className="flex-1 min-h-0 opacity-50">
                    <SunburstChart
                      data={filteredOutRoot}
                      onClick={handleNoOpClick}
                      arcLabel={arcLabel}
                      tooltip={SunburstTooltip}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
