import './index.css';
import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { ResponsiveSunburst } from '@nivo/sunburst';
import type { ComputedDatum } from '@nivo/sunburst'; // Import Nivo types
import type { ColorModifier } from '@nivo/colors'; // Import color types
import { TreeNode, ApiResponse, NivoDataNode } from './types';

// --- Constants ---
const VALUE_KEY = 'value';
const ARC_LABEL_SKIP_ANGLE = 20;
const ARC_LABEL_RADIUS_OFFSET = 0.5;
const ARC_LABEL_FONT_WEIGHT = 'bolder'; // Use constant
// Explicitly type the modifier array to satisfy Nivo's expected type
const ARC_LABEL_MODIFIER: ColorModifier[] = [['darker', 1.5]]; // Use constant
const DEFAULT_EXCLUSIONS = ['node_modules', 'dist', 'target', '.git', '.idea', '.vscode']; // Common folders to exclude by default
const NODE_COUNT_THRESHOLD = 10000; // Prune if total nodes exceed this
const FULL_DEPTH = 1000; // Effective infinity for Nivo
const MIN_PRUNE_DEPTH = 3; // Don't prune shallower than this

// --- Import Utilities ---
import { formatSize } from './utils/formatting';
import {
  getDisplayPath,
  toNivoTree,
  calculateNivoTreeSize,
  calculateExtensionNivoSizes,
  findNodeById, // Note: findNodeById expects string ID
  pruneTreeDepth,
  calculateDynamicDepth, // Import the new dynamic depth calculator
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

// NEW: Exclusion Checkbox Component (or integrate into Controls Panel)
const ExclusionCheckboxes: React.FC<{
  exclusions: string[];
  setExclusions: (value: string[]) => void;
  options: string[];
  loading: boolean;
}> = ({ exclusions, setExclusions, options, loading }) => {
  const handleCheckboxChange = (option: string, checked: boolean) => {
    setExclusions(
      checked
        ? [...exclusions, option] // Add to exclusions
        : exclusions.filter((item) => item !== option) // Remove from exclusions
    );
  };

  return (
    <div className="space-y-2 border-t border-gray-800/50 pt-3 mt-3">
      <label className="block text-sm font-medium text-gray-300 mb-1">Exclude Folders:</label>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {options.map((option) => (
          <div key={option} className="flex items-center">
            <input
              id={`exclude-${option}`}
              name={`exclude-${option}`}
              type="checkbox"
              checked={exclusions.includes(option)}
              onChange={(e) => handleCheckboxChange(option, e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 disabled:opacity-50"
            />
            <label
              htmlFor={`exclude-${option}`}
              className="ml-2 block text-xs text-gray-400 select-none"
            >
              <code>{option}</code>
            </label>
          </div>
        ))}
      </div>
      {/* Optional: Add input for custom exclusions later */}
    </div>
  );
};

const SunburstChart: React.FC<{
  // Data type updated slightly, could be NivoDataNode | null
  data: NivoDataNode | null;
  onClick: (node: ComputedDatum<NivoDataNode>) => void; // Update type here too
  arcLabel: (d: ComputedDatum<NivoDataNode>) => string; // Update type
  tooltip: (node: ComputedDatum<NivoDataNode>) => React.ReactNode; // Update type
}> = memo(({ data, onClick, arcLabel, tooltip }) => {
  if (!data) return null; // Render nothing if data is null

  return (
    <ResponsiveSunburst
      data={data}
      value={VALUE_KEY} // Still using 'value' from leaf nodes
      cornerRadius={2}
      borderColor={{ from: 'color', modifiers: [['darker', 0.6]] }}
      colors={{ scheme: 'nivo' }}
      childColor={{ from: 'color' }}
      animate={false}
      motionConfig="gentle"
      onClick={onClick}
      tooltip={tooltip}
      enableArcLabels={true}
      arcLabel={arcLabel}
      arcLabelsSkipAngle={ARC_LABEL_SKIP_ANGLE} // Use constant
      arcLabelsRadiusOffset={ARC_LABEL_RADIUS_OFFSET} // Use constant
      arcLabelsTextColor={{ from: 'color', modifiers: ARC_LABEL_MODIFIER }} // Use constant
      theme={{
        labels: {
          text: {
            fontWeight: ARC_LABEL_FONT_WEIGHT, // Use constant
          },
        },
      }}
    />
  );
});

// --- Main App ---
const App: React.FC = () => {
  const [folderPath, setFolderPath] = useState<string>('');
  const [folderData, setFolderData] = useState<TreeNode | null>(null);
  const [nivoData, setNivoData] = useState<NivoDataNode | null>(null);
  const [nodeStack, setNodeStack] = useState<NivoDataNode[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [extensionFilter, setExtensionFilter] = useState<string>('');
  const [debouncedSearchText, setDebouncedSearchText] = useState<string>('');
  const [debouncedExtensionFilter, setDebouncedExtensionFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backendErrors, setBackendErrors] = useState<string[]>([]);
  const [showFolderInput, setShowFolderInput] = useState<boolean>(true);
  const [excludedFolders, setExcludedFolders] = useState<string[]>(DEFAULT_EXCLUSIONS); // State for exclusions

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
    const nivoTree = toNivoTree(treeData); // Returns any
    setNivoData(nivoTree as NivoDataNode);
    setNodeStack([nivoTree as NivoDataNode]);
    setFolderPath(path);
    setShowFolderInput(false);
    // Clear previous filters/errors
    setSearchText('');
    setDebouncedSearchText('');
    setExtensionFilter('');
    setDebouncedExtensionFilter('');
    setError(null);
    setBackendErrors([]);
  }, []);

  // --- Handler to start a new analysis ---
  const handleStartNewAnalysis = useCallback(() => {
    setShowFolderInput(true);
    setFolderData(null);
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
  }, []);

  // --- API Call (Updated) ---
  const sendFolderPathToBackend = useCallback(
    async (path: string) => {
      setLoading(true);
      // Clear errors immediately for new request
      setError(null);
      setBackendErrors([]);
      try {
        const encodedPath = encodeURIComponent(path);
        // Build exclude query parameter
        const excludeParam =
          excludedFolders.length > 0
            ? `?exclude=${encodeURIComponent(excludedFolders.join(','))}`
            : '';
        const apiUrl = `/api/analyze-folder/${encodedPath}${excludeParam}`; // Append query param

        console.log(`Fetching: ${apiUrl}`); // Log the final URL

        const response = await fetch(apiUrl, {
          // Use updated URL
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
      } catch (err: unknown) {
        // Handle fetch/network errors
        const message = err instanceof Error ? err.message : String(err);
        setError(`Network or fetch error: ${message}`);
        setFolderData(null);
        setNivoData(null);
        setNodeStack([]);
        setBackendErrors([]);
        setShowFolderInput(true); // Keep input visible
      } finally {
        setLoading(false);
      }
    },
    [handleAnalysisSuccess, excludedFolders]
  );

  // --- Drilldown & Filtering Logic Callbacks ---
  const handleClearFilter = useCallback(() => {
    setSearchText('');
    setDebouncedSearchText('');
    setExtensionFilter('');
    setDebouncedExtensionFilter('');
  }, []);

  // --- Memoized Data Calculations ---
  const currentRoot = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : nivoData;

  // Calculate effective depth based on node count and distribution
  const effectiveMaxDepth = useMemo(() => {
    // Call the extracted utility function
    return calculateDynamicDepth(currentRoot, NODE_COUNT_THRESHOLD, MIN_PRUNE_DEPTH, FULL_DEPTH);
  }, [currentRoot]); // Keep dependency on currentRoot

  // Prune the current view using the dynamic depth
  const prunedCurrentRoot = useMemo(
    () => pruneTreeDepth(currentRoot, effectiveMaxDepth),
    [currentRoot, effectiveMaxDepth]
  );

  const handleClick = useCallback(
    (node: ComputedDatum<NivoDataNode>) => {
      if (!node || !node.id) return;
      // Find node in the ORIGINAL data for drilldown, not the pruned version
      const originalNode = findNodeById(currentRoot, node.id as string);
      if (originalNode && originalNode.children && originalNode.children.length > 0) {
        setNodeStack((prevStack) => [...prevStack, originalNode as NivoDataNode]);
      }
    },
    [currentRoot] // Keep dependency on original currentRoot for finding nodes
  );

  // Restore handleBack definition
  const handleBack = useCallback(() => {
    setNodeStack((prevStack) => {
      if (prevStack.length > 1) {
        return prevStack.slice(0, -1);
      }
      return prevStack;
    });
  }, []); // Dependency: setNodeStack (stable)

  // Filter the PRUNED data
  const { filteredPrunedRoot, filteredOutPrunedRoot } = useMemo(() => {
    const filterIsOn = !!(debouncedSearchText || debouncedExtensionFilter);
    if (!prunedCurrentRoot) {
      // Check pruned version
      return { filteredPrunedRoot: null, filteredOutPrunedRoot: null };
    }
    if (!filterIsOn) {
      return { filteredPrunedRoot: prunedCurrentRoot, filteredOutPrunedRoot: null };
    }
    // Filter the pruned tree
    const matching = filterTree(
      prunedCurrentRoot,
      debouncedSearchText,
      debouncedExtensionFilter
    );
    if (!matching) {
      return { filteredPrunedRoot: null, filteredOutPrunedRoot: prunedCurrentRoot };
    }
    // Get filtered out based on pruned original vs filtered result
    const filteredOut = getFilteredOutTree(prunedCurrentRoot, matching);
    return {
      filteredPrunedRoot: matching as NivoDataNode | null,
      filteredOutPrunedRoot: filteredOut as NivoDataNode | null,
    };
  }, [prunedCurrentRoot, debouncedSearchText, debouncedExtensionFilter]); // Use prunedCurrentRoot

  // Calculations use pruned data (no changes needed here)
  const totalSizeCurrent = useMemo(
    () => calculateNivoTreeSize(currentRoot), // Use UNPRUNED currentRoot for accurate total
    [currentRoot] // Depend on unpruned currentRoot
  );
  const totalSizeFiltered = useMemo(
    () => calculateNivoTreeSize(filteredPrunedRoot),
    [filteredPrunedRoot]
  );
  const totalSizeFilteredOut = useMemo(
    () => calculateNivoTreeSize(filteredOutPrunedRoot),
    [filteredOutPrunedRoot]
  );

  // Original extension sizes still use original data
  const originalExtensionSizes = useMemo(() => {
    const sourceData = nivoData || (folderData ? toNivoTree(folderData) : null);
    // Use the original, unpruned nivoData for calculating total extension sizes
    return calculateExtensionNivoSizes(sourceData);
  }, [folderData, nivoData]);

  // Extension options still based on original sizes
  const extensionOptions = useMemo(() => {
    const sortedExtensions = Object.entries(originalExtensionSizes)
      .map(([ext, size]) => ({ ext, size }))
      .sort((a, b) => b.size - a.size);
    return sortedExtensions.map((item) => item.ext);
  }, [originalExtensionSizes]);

  // Filtered extension sizes use pruned data
  const filteredExtensionSizes = useMemo(
    () => calculateExtensionNivoSizes(filteredPrunedRoot),
    [filteredPrunedRoot]
  );
  const filteredOutExtensionSizes = useMemo(
    () => calculateExtensionNivoSizes(filteredOutPrunedRoot),
    [filteredOutPrunedRoot]
  );

  // --- Helper functions for rendering logic ---
  // isFilterActive can now use the debounced state directly
  const isFilterActive = (): boolean => !!(debouncedSearchText || debouncedExtensionFilter);

  // --- Tooltip and ArcLabel Callbacks (Update Types and cast ID) ---
  const SunburstTooltip = useCallback(
    (node: ComputedDatum<NivoDataNode>) => {
      // Cast node.id to string as getDisplayPath expects string
      const displayPath = getDisplayPath(node.id as string, folderPath);
      const sizeStr = typeof node.value === 'number' ? formatSize(node.value) : 'N/A';
      const nameStr = node.data.name || 'Unknown';

      return (
        <div
          className="bg-gray-900 text-gray-100 p-3 rounded-lg shadow-xl border border-gray-800"
          aria-label={`Tooltip for ${nameStr}`}
        >
          <strong className="block text-sm font-medium">{nameStr}</strong>
          <span className="text-sm text-gray-400">({sizeStr})</span>
          <div className="text-xs text-gray-500 mt-1">{displayPath}</div>
        </div>
      );
    },
    [folderPath]
  );

  const arcLabel = useCallback((d: ComputedDatum<NivoDataNode>) => {
    const sizeStr = typeof d.value === 'number' ? formatSize(d.value) : 'N/A';
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

            {/* Render ExclusionCheckboxes *before* analysis */}
            {showFolderInput && (
              <ExclusionCheckboxes
                exclusions={excludedFolders}
                setExclusions={setExcludedFolders}
                options={DEFAULT_EXCLUSIONS} // Use default options for checkboxes
                loading={loading}
              />
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

            {/* NEW: Display Active Filters */}
            {isFilterActive() && !loading && folderData && (
              <div className="text-xs text-gray-400 border-t border-gray-800/50 pt-3 mt-3">
                Active Filters:
                {debouncedSearchText && (
                  <span className="block ml-2">- Text: "{debouncedSearchText}"</span>
                )}
                {debouncedExtensionFilter && (
                  <span className="block ml-2">- Extension: {debouncedExtensionFilter}</span>
                )}
              </div>
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
              {!isFilterActive() && prunedCurrentRoot ? ( // Check prunedCurrentRoot
                <div className="flex-1 flex flex-col min-h-0">
                  <h2 className="text-center text-sm font-semibold text-gray-300 mb-1 shrink-0 h-5">
                    Total: {formatSize(totalSizeCurrent)}
                  </h2>
                  <div className="flex-1 min-h-0">
                    <SunburstChart
                      data={prunedCurrentRoot} // Use pruned data
                      onClick={handleClick}
                      arcLabel={arcLabel}
                      tooltip={SunburstTooltip}
                    />
                  </div>
                </div>
              ) : isFilterActive() ? (
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  <h2 className="text-center text-sm font-semibold text-gray-300 mb-1 shrink-0 h-5">
                    Matching Results ({formatSize(totalSizeFiltered)})
                  </h2>
                  {filteredPrunedRoot ? ( // Check filteredPrunedRoot
                    <div className="flex-1 min-h-0">
                      <SunburstChart
                        data={filteredPrunedRoot} // Use pruned data
                        onClick={handleClick}
                        arcLabel={arcLabel}
                        tooltip={SunburstTooltip}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-gray-500 p-4">
                      No items match the current filter.
                    </div>
                  )}
                </div>
              ) : null}

              {/* Right Section / Bottom Section - Filtered Out */}
              {isFilterActive() && (
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  <h2 className="text-center text-sm font-semibold text-gray-400 mb-1 shrink-0 h-5">
                    Filtered Out ({formatSize(totalSizeFilteredOut)})
                  </h2>
                  {filteredOutPrunedRoot ? ( // Check filteredOutPrunedRoot
                    <div className="flex-1 min-h-0 opacity-50">
                      <SunburstChart
                        data={filteredOutPrunedRoot} // Use pruned data
                        onClick={handleClick} // Still allow click (uses original data)
                        arcLabel={arcLabel}
                        tooltip={SunburstTooltip}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-gray-500 p-4">
                      All items match the current filter.
                    </div>
                  )}
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
