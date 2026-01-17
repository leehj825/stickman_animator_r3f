
## Library Usage

To use this library in another React Three Fiber project:

1. **Install dependencies:**
   ```bash
   npm install stickman-animator-r3f three @react-three/fiber @react-three/drei
   ```

2. **Import and use the component:**

   ```tsx
   import React, { useEffect, useState } from 'react';
   import { Canvas } from '@react-three/fiber';
   import { Stickman, parseStickmanProject, StickmanProjectData } from 'stickman-animator-r3f';

   const App = () => {
     const [projectData, setProjectData] = useState<StickmanProjectData | null>(null);

     useEffect(() => {
       // Load your .sa3 or .json file
       fetch('/my-animation.sa3')
         .then(res => res.text())
         .then(text => {
            const data = parseStickmanProject(text);
            setProjectData(data);
         });
     }, []);

     return (
       <Canvas camera={{ position: [0, 2, 5] }}>
         <ambientLight intensity={0.5} />
         <directionalLight position={[5, 5, 5]} />

         {projectData && (
           <Stickman
             projectData={projectData}
             autoPlay={true}
             position={[0, 0, 0]}
           />
         )}

         <gridHelper />
       </Canvas>
     );
   };

   export default App;
   ```
