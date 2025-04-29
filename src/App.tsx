import './index.css';
import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { ResponsiveSunburst } from '@nivo/sunburst';
import { TreeNode, ApiResponse } from './types';

// --- Constants ---
const VALUE_KEY = 'value';

// --- Import Utilities ---
import { formatSize } from './utils/formatting';
import {
  getDisplayPath,
  getExtensionsFromTree,
  toNivoTree,
  calculateNivoTreeSize,
  calculateExtensionNivoSizes,
  findNodeById,
} from './utils/treeUtils';
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
      className="px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white bg-blue-600 hover:bg-blue-700"
      disabled={!folderPath || loading}
      aria-label="Analyze"
    >
      {loading ? 'Analyzing...' : 'Analyze'}
    </button>
  </div>
);

const FilterBar: React.FC<{
  searchText: string;
  setSearchText: (v: string) => void;
  extensionFilter: string;
  setExtensionFilter: (v: string) => void;
  extensionOptions: string[];
  onClear: () => void;
  loading: boolean;
}> = ({
  searchText,
  setSearchText,
  extensionFilter,
  setExtensionFilter,
  extensionOptions,
  onClear,
  loading,
}) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
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
        type="button"
        className="px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700/50"
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
    className="text-blue-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs border border-blue-900/20 bg-blue-950/30"
    role="status"
  >
    <svg
      className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"
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
      Click folder to zoom in. Use <b>Back</b> to zoom out.
    </span>
  </div>
);

const SunburstChart: React.FC<{
  data: any;
  onClick: (node: any) => void;
  arcLabel: (d: any) => string;
  tooltip: (node: any) => React.ReactNode;
}> = memo(({ data, onClick, arcLabel, tooltip }) => {
  return (
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
  );
});

// --- Main App ---
const App: React.FC = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [folderData, setFolderData] = useState<TreeNode | null>(null);
  const [nivoData, setNivoData] = useState<any>(null);
  const [nodeStack, setNodeStack] = useState<any[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [extensionFilter, setExtensionFilter] = useState<string>('');
  const [debouncedSearchText, setDebouncedSearchText] = useState<string>('');
  const [debouncedExtensionFilter, setDebouncedExtensionFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backendErrors, setBackendErrors] = useState<string[]>([]);
  const [showFolderInput, setShowFolderInput] = useState<boolean>(true);

  // Debounce Effect for Search and Extension Filters
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
      setDebouncedExtensionFilter(extensionFilter);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [searchText, extensionFilter]);

  // --- Handler for successful analysis ---
  const handleAnalysisSuccess = useCallback((treeData: TreeNode, path: string) => {
    setFolderData(treeData);
    const nivoTree = toNivoTree(treeData, true);
    setNivoData(nivoTree);
    setNodeStack([nivoTree]);
    setFolderPath(path); // Store the analyzed path for display
    setShowFolderInput(false); // Hide input on success
    // Clear previous filters/errors that might be lingering
    setSearchText('');
    setDebouncedSearchText('');
    setExtensionFilter('');
    setDebouncedExtensionFilter('');
    setError(null);
    setBackendErrors([]);
  }, []); // Dependencies: The setters are stable

  // --- Handler to start a new analysis ---
  const handleStartNewAnalysis = useCallback(() => {
    setShowFolderInput(true); // Show input again
    setFolderData(null); // Clear previous results/state
    setNivoData(null);
    setNodeStack([]);
    setBackendErrors([]);
    setError(null);
    // Optionally clear folderPath too, or leave it as a suggestion
    // setFolderPath('');
    // Clear filters as well
    setSearchText('');
    setDebouncedSearchText('');
    setExtensionFilter('');
    setDebouncedExtensionFilter('');
  }, []); // Dependencies: The setters are stable

  // --- API Call (Updated) ---
  const sendFolderPathToBackend = useCallback(async (path: string) => {
    setLoading(true);
    // Clear errors immediately for new request
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
          handleAnalysisSuccess(data.tree, path); // Use success handler
        } else {
          // Handle OK but no tree data case
          setError(data.message || 'Analysis completed but no data received.');
          setFolderData(null);
          setNivoData(null);
          setNodeStack([]);
          setShowFolderInput(true); // Keep input visible
        }
        // Handle non-fatal backend processing errors even if tree exists
        if (data.errors && data.errors.length > 0) {
          setBackendErrors(data.errors);
        }
      } else {
        // Handle non-OK response (4xx, 5xx)
        setError(data.message || 'Unknown error from server');
        setFolderData(null);
        setNivoData(null);
        setNodeStack([]);
        setShowFolderInput(true); // Keep input visible
      }
    } catch (err: any) {
      // Handle fetch/network errors
      setError('Network or fetch error: ' + err.message);
      setFolderData(null);
      setNivoData(null);
      setNodeStack([]);
      setBackendErrors([]);
      setShowFolderInput(true); // Keep input visible
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Drilldown & Filtering Logic Callbacks ---
  const handleClearFilter = useCallback(() => {
    setSearchText('');
    setDebouncedSearchText('');
    setExtensionFilter('');
    setDebouncedExtensionFilter('');
  }, []);

  // const handleNoOpClick = useCallback(() => {}, []);

  // --- Memoized Data Calculations ---
  // Define currentRoot early as handleClick depends on it
  const currentRoot = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : nivoData;

  // Modify handleClick to find original node
  const handleClick = useCallback(
    (node: any) => {
      // node is from Nivo onClick
      if (!node || !node.id) return; // Guard against missing node or id

      // Find the corresponding node in the *current unfiltered view*
      const originalNode = findNodeById(currentRoot, node.id);

      if (originalNode && originalNode.children && originalNode.children.length > 0) {
        // If the original node is a directory, push ITS data onto the stack
        setNodeStack((prevStack) => [...prevStack, originalNode]);
      }
      // If it's a file or not found, do nothing on click
    },
    [currentRoot]
  ); // Dependency: currentRoot (to search in) and setNodeStack (stable)

  // Restore handleBack definition
  const handleBack = useCallback(() => {
    setNodeStack((prevStack) => {
      if (prevStack.length > 1) {
        return prevStack.slice(0, -1);
      }
      return prevStack;
    });
  }, []); // Dependency: setNodeStack (stable)

  // Combine filteredRoot and filteredOutRoot calculation into one memo
  const { filteredRoot, filteredOutRoot } = useMemo(() => {
    const filterIsOn = !!(debouncedSearchText || debouncedExtensionFilter);

    if (!filterIsOn) {
      // No filter: matching is current, filtered out is null
      // Use the already defined currentRoot
      return { filteredRoot: currentRoot, filteredOutRoot: null };
    }

    // Filter is on: calculate matching part
    const matching = filterTree(currentRoot, debouncedSearchText, debouncedExtensionFilter, true);

    if (!matching) {
      // Filter matched nothing: matching is null, filtered out is current
      // Use the already defined currentRoot
      return { filteredRoot: null, filteredOutRoot: currentRoot };
    }

    // Filter matched something: calculate the difference for filtered out
    const filteredOut = getFilteredOutTree(currentRoot, matching, true);
    return { filteredRoot: matching, filteredOutRoot: filteredOut };
  }, [currentRoot, debouncedSearchText, debouncedExtensionFilter]); // Depend only on view and filters

  // Calculate total sizes (now depend on the combined memo results)
  const totalSizeCurrent = useMemo(() => calculateNivoTreeSize(currentRoot), [currentRoot]);
  const totalSizeFiltered = useMemo(() => calculateNivoTreeSize(filteredRoot), [filteredRoot]);
  const totalSizeFilteredOut = useMemo(
    () => calculateNivoTreeSize(filteredOutRoot),
    [filteredOutRoot]
  );

  // Calculate extension sizes for the original data (for sorting dropdown)
  const originalExtensionSizes = useMemo(() => {
    const sourceData = nivoData || (folderData ? toNivoTree(folderData, true) : null);
    return calculateExtensionNivoSizes(sourceData);
  }, [folderData, nivoData]);

  // Calculate options for the dropdown, sorted by size
  const extensionOptions = useMemo(() => {
    const sortedExtensions = Object.entries(originalExtensionSizes)
      .map(([ext, size]) => ({ ext, size }))
      .sort((a, b) => b.size - a.size);
    return sortedExtensions.map((item) => item.ext);
  }, [originalExtensionSizes]);

  // Calculate extension sizes for filtered views (now depend on combined memo results)
  const filteredExtensionSizes = useMemo(
    () => calculateExtensionNivoSizes(filteredRoot),
    [filteredRoot]
  );
  const filteredOutExtensionSizes = useMemo(
    () => calculateExtensionNivoSizes(filteredOutRoot),
    [filteredOutRoot]
  );

  // --- Helper functions for rendering logic ---
  // isFilterActive can now use the debounced state directly
  const isFilterActive = (): boolean => !!(debouncedSearchText || debouncedExtensionFilter);

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
      {/* Header - Reduce bottom margin */}
      <header className="flex-none text-center py-3 mb-1">
        {' '}
        {/* Reduced py and mb */}
        <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">
          {' '}
          {/* Reduced text size */}
          Folder Sunburst Explorer
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-xs px-4">
          {' '}
          {/* Reduced text size */}
          Instantly visualize your disk usage. Analyze any folder, then filter and drill down to
          find large files and folders fast.
        </p>
      </header>

      {/* Main Content: Use Flexbox (col default, row on large) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 p-4 pb-6 overflow-hidden">
        {/* Controls Panel (Flex Item 1) */}
        <div className="lg:w-[350px] lg:shrink-0 lg:sticky lg:top-4 overflow-y-auto">
          {' '}
          {/* Define width & prevent shrinking on large screens */}
          <div className="bg-gray-900/40 backdrop-blur-sm rounded-xl shadow-xl p-4 space-y-4 border border-gray-800/20">
            {/* Conditionally show Folder Input or Analyzed Path */}
            {showFolderInput ? (
              <FolderInput
                folderPath={folderPath}
                onChange={setFolderPath}
                onSubmit={() => folderPath && sendFolderPathToBackend(folderPath)}
                loading={loading}
              />
            ) : (
              <div className="flex items-center justify-between gap-2 text-sm p-2 bg-gray-800/30 rounded-lg min-w-0">
                <span className="text-gray-300 truncate min-w-0" title={folderPath}>
                  Analyzed: <code className="text-gray-100 font-mono">{folderPath}</code>
                </span>
                <button
                  onClick={handleStartNewAnalysis}
                  className="text-blue-400 hover:text-blue-300 text-xs font-medium shrink-0 px-2 py-1 rounded hover:bg-blue-900/30"
                >
                  Change
                </button>
              </div>
            )}

            {/* Conditionally render FilterBar only after successful analysis */}
            {!showFolderInput && folderData && (
              <FilterBar
                searchText={searchText}
                setSearchText={setSearchText}
                extensionFilter={extensionFilter}
                setExtensionFilter={setExtensionFilter}
                extensionOptions={extensionOptions}
                onClear={handleClearFilter}
                loading={loading}
              />
            )}

            {/* Display Extension Breakdown - Make Collapsible */}
            {isFilterActive() && !loading && folderData && (
              <div className="mt-4 space-y-2 text-xs">
                {' '}
                {/* Reduced space-y */}
                {Object.keys(filteredExtensionSizes).length > 0 && (
                  // Use <details> for collapsible section
                  <details className="bg-gray-800/30 rounded-lg group">
                    <summary className="p-2 cursor-pointer list-none font-semibold text-gray-300 group-open:border-b group-open:border-gray-700/50">
                      Matching Extensions ({Object.keys(filteredExtensionSizes).length})
                    </summary>
                    <div className="p-2 pt-1.5">
                      {' '}
                      {/* Padding inside the details */}
                      <ul className="space-y-0.5 max-h-24 overflow-y-auto text-gray-400">
                        {Object.entries(filteredExtensionSizes)
                          .sort(([, sizeA], [, sizeB]) => sizeB - sizeA)
                          .map(([ext, size]) => (
                            <li key={ext} className="flex justify-between">
                              <span className="font-mono truncate pr-2">{ext}</span>
                              <span className="font-mono shrink-0">{formatSize(size)}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </details>
                )}
                {Object.keys(filteredOutExtensionSizes).length > 0 && (
                  // Use <details> for collapsible section
                  <details className="bg-gray-800/30 rounded-lg opacity-70 group">
                    <summary className="p-2 cursor-pointer list-none font-semibold text-gray-400 group-open:border-b group-open:border-gray-700/50">
                      Filtered Out Extensions ({Object.keys(filteredOutExtensionSizes).length})
                    </summary>
                    <div className="p-2 pt-1.5">
                      {' '}
                      {/* Padding inside the details */}
                      <ul className="space-y-0.5 max-h-24 overflow-y-auto text-gray-500">
                        {Object.entries(filteredOutExtensionSizes)
                          .sort(([, sizeA], [, sizeB]) => sizeB - sizeA)
                          .map(([ext, size]) => (
                            <li key={ext} className="flex justify-between">
                              <span className="font-mono truncate pr-2">{ext}</span>
                              <span className="font-mono shrink-0">{formatSize(size)}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Back button - only shown when drilled down AND input is hidden */}
            {!showFolderInput && nodeStack.length > 1 && (
              <button
                onClick={handleBack} // Use stable handler
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
            {/* Fatal Error Display - shown regardless of input state */}
            {error && (
              <div
                className="bg-red-950/40 text-red-200 rounded-lg px-4 py-3 border border-red-900/20"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>
          {/* Conditionally render DrilldownAlert only after successful analysis */}
          {!showFolderInput && folderData && (
            <div className="mt-4">
              <DrilldownAlert />
            </div>
          )}
          {/* Conditionally render Backend Errors only after successful analysis (or during analysis) */}
          {!showFolderInput && backendErrors.length > 0 && (
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

        {/* Chart Area - Enable overflow */}
        <div className="flex-1 min-h-0 min-w-0 bg-gray-900/40 backdrop-blur-sm rounded-xl shadow-xl border border-gray-800/20 flex flex-col overflow-auto">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-screen">
              <span className="loader" aria-label="Loading" />
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex items-center justify-center h-screen text-red-400 p-4">
              Error: {error}
            </div>
          )}

          {/* Initial State (No Data) */}
          {!loading && !error && !folderData && (
            <div className="flex items-center justify-center h-screen text-gray-500 p-4">
              Enter a folder path above and click "Analyze Folder" to start.
            </div>
          )}

          {/* Data Loaded State - Remove h-screen, Keep flex-1 */}
          {!loading && !error && folderData && (
            <div
              // Apply multi-breakpoint flex direction and gap
              className={`flex flex-1 flex-col md:flex-row lg:flex-col xl:flex-row min-h-0 p-2 gap-4 md:gap-2 lg:gap-4 xl:gap-2`}
            >
              {/* Left Section / Top Section */}
              {!isFilterActive() && currentRoot ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <h2 className="text-center text-sm font-semibold text-gray-300 mb-1 shrink-0 h-5">
                    Total: {formatSize(totalSizeCurrent)}
                  </h2>
                  <div className="flex-1 min-h-0">
                    <SunburstChart
                      data={currentRoot}
                      onClick={handleClick}
                      arcLabel={arcLabel}
                      tooltip={SunburstTooltip}
                    />
                  </div>
                </div>
              ) : isFilterActive() ? (
                // Make section flex-1, keep flex-col internally
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {filteredRoot ? (
                    <>
                      <h2 className="text-center text-sm font-semibold text-gray-300 mb-1 shrink-0 h-5">
                        Matching Results ({formatSize(totalSizeFiltered)})
                      </h2>
                      {/* Inner chart wrapper still has flex-1 */}
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
                    <div className="flex items-center justify-center text-gray-500 p-4">
                      No items match the current filter.
                    </div>
                  )}
                </div>
              ) : null}

              {/* Right Section */}
              {isFilterActive() && filteredOutRoot && (
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {isFilterActive() && (
                    <h2 className="text-center text-sm font-semibold text-gray-400 mb-1 shrink-0 h-5">
                      Filtered Out ({formatSize(totalSizeFilteredOut)})
                    </h2>
                  )}
                  <div className="flex-1 min-h-0 opacity-50">
                    <SunburstChart
                      data={filteredOutRoot}
                      onClick={handleClick}
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
