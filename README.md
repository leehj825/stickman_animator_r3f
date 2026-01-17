# Stickman Animator R3F

This project serves as both a standalone 3D animation editor and an embeddable runtime library for React Three Fiber (R3F) applications.

## Editor

To run the editor locally:

```bash
npm install
npm run dev
```

## Runtime Library

The project includes a lightweight runtime library located in `src/runtime/`. This allows other developers to load and play animations created in the editor within their own R3F scenes, without importing the heavy editor logic or UI.

### Building the Library

To build the runtime library:

```bash
npm run build:lib
```

This will generate a `dist-lib/` folder containing:
- `stickman-runtime.es.js` (ES Module)
- `stickman-runtime.umd.cjs` (CommonJS)
- Type definitions (`.d.ts`)

### Using the Library

1. **Install Dependencies**:
   Ensure your consuming project has the peer dependencies installed:
   ```bash
   npm install three @react-three/fiber @react-three/drei
   ```

2. **Importing**:
   You can copy the `dist-lib` folder to your project or install this repo as a dependency.

   *Example Usage:*

   ```tsx
   import { Canvas } from '@react-three/fiber';
   import { useEffect, useState } from 'react';
   import { parseStickmanProject, StickmanPlayer, ParsedStickmanProject } from './path/to/dist-lib'; // or package name

   const AnimationViewer = () => {
     const [projectData, setProjectData] = useState<ParsedStickmanProject | null>(null);

     useEffect(() => {
       fetch('/path/to/my-animation.sa3')
         .then(res => res.text())
         .then(json => {
            const data = parseStickmanProject(json);
            setProjectData(data);
         });
     }, []);

     if (!projectData) return <div>Loading...</div>;

     return (
       <Canvas>
         <ambientLight />
         <StickmanPlayer
           projectData={projectData}
           isPlaying={true}
           scale={1}
         />
       </Canvas>
     );
   };
   ```

### API Reference

#### `parseStickmanProject(json: string): ParsedStickmanProject`
- **json**: The raw JSON string from a `.sa3` file.
- **Returns**: A clean object containing `clips`, `currentSkeleton`, and `meta` data.
- **Note**: This function handles legacy file normalization automatically.

#### `<StickmanPlayer />`
A React component that renders the stickman. It must be placed inside a `<Canvas>`.

- **Props**:
  - `projectData`: The object returned by `parseStickmanProject`.
  - `isPlaying`: Boolean to control playback.
  - `scale` (optional): Scale factor (default: 1).
  - `loop` (optional): Whether to loop the animation (default: true).
