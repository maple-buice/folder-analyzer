# Folder Sunburst Explorer

![Folder Sunburst Explorer](https://img.shields.io/badge/visualization-sunburst-blue?style=flat-square)

**Visualize your folder structure and file sizes as an interactive sunburst chart. Drill down, filter by name or extension, and explore your disk usage visually.**

## Features

- Visualizes folder structure and file sizes as an interactive sunburst chart
- Drilldown and zoom out navigation
- Filter by file/folder name and extension
- Tooltips and arc labels show file/folder names and sizes (in KB/MB)
- Modern, responsive UI built with React and Tailwind CSS

## Setup

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun dev
```

For production:

```bash
bun start
```

## Usage

1. Enter the path to the folder you want to analyze in the input box.
2. Click "Analyze Folder".
3. Explore the sunburst chart:
   - Hover over arcs to see tooltips with name, size, and path.
   - Click a folder to zoom in; use the Back button to zoom out.
   - Use the filter bar to search by name or extension.

## Customization

- You can adjust the sunburst appearance (colors, label angles, etc.) in the `ResponsiveSunburst` props in `src/App.tsx`.

## Tech Stack

- [Bun](https://bun.sh) (runtime & dev server)
- [React](https://react.dev/) (UI)
- [Tailwind CSS](https://tailwindcss.com/) (styling)
- [Nivo Sunburst](https://nivo.rocks/sunburst/) (visualization)

## API Example

The backend exposes a single endpoint:

```
GET /api/analyze-folder/:path
```

Returns JSON:

```json
{
  "message": "Folder analysis complete",
  "tree": {
    "id": "/path/to/folder",
    "name": "root",
    "children": [
      { "id": "/path/to/folder/file.txt", "name": "file.txt", "size": 1234, "key": "/path/to/folder/file.txt" },
      { "id": "/path/to/folder/subdir", "name": "subdir", "children": [...], "size": 5678, "key": "/path/to/folder/subdir" }
    ],
    "size": 6912,
    "key": "/path/to/folder"
  }
}
```

## Development

- Run lint: `bun run lint`
- Run formatter: `bun run format`
- Type-check: `bun run type-check`
- Run tests: `bun run test`

## Contributing

Contributions are welcome! Please open issues or pull requests for bugs, features, or improvements.

1. Fork the repo and create a branch.
2. Run lint, format, and type-check before submitting.
3. Add/adjust tests for new features.

## Screenshot

**Unfiltered View:**

![Unfiltered Screenshot](docs/screenshots/unfiltered.png)

**Filtered View (Example):**

![Filtered Screenshot](docs/screenshots/filtered.png)
