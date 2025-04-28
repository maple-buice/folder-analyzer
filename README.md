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

