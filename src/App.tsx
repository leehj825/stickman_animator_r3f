import { StickmanRenderer } from './components/StickmanRenderer';
import { EditorUI } from './components/EditorUI';

function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      <StickmanRenderer />
      <EditorUI />
    </div>
  );
}

export default App;
