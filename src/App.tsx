import { Stickman3DRenderer } from './components/Stickman3DRenderer';
import { EditorUI } from './components/EditorUI';

function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <Stickman3DRenderer />
      <EditorUI />
    </div>
  );
}

export default App;
