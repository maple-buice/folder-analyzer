# Folder Analyzer

A web app to visually explore the structure and disk usage of a folder using a Nivo Sunburst chart. Analyze any directory and drill down into subfolders to see which files and folders are taking up the most space.

## Features

- Visualizes folder structure and file sizes as an interactive sunburst chart
- Drilldown and zoom out navigation
- Tooltips and arc labels show file/folder names and sizes (in KB/MB)
- Customizable path prefix for cleaner display
- Built with React, Bun, Tailwind CSS, and Nivo

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
   - Click on a folder to zoom in; use the Back button to zoom out.
   - Arc labels show the name and size (in KB/MB) for larger arcs.

## Customization

- The path prefix removed from displayed paths is set in `src/App.tsx` as `PATH_PREFIX`.
- You can adjust the sunburst appearance (colors, label angles, etc.) in the `ResponsiveSunburst` props in `src/App.tsx`.

## Tech Stack

- [Bun](https://bun.sh) (runtime & dev server)
- [React](https://react.dev/) (UI)
- [Tailwind CSS](https://tailwindcss.com/) (styling)
- [Nivo Sunburst](https://nivo.rocks/sunburst/) (visualization)

---

This project was created using `bun init` in bun v1.2.6.
