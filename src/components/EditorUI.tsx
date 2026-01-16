import { useStickmanStore } from '../store/useStickmanStore';
import { Play, Pause, Save, FolderOpen, Plus, MousePointer2 } from 'lucide-react';
import clsx from 'clsx';

export const EditorUI = () => {
  const {
      isPlaying, togglePlay,
      editMode, setEditMode,
      addKeyframe, currentTime, currentClip,
      saveProject, loadProject
  } = useStickmanStore();

  const handleSave = () => {
      const json = saveProject();
      console.log(json);
      // In a real app, trigger download or save to file
      alert("Project JSON logged to console");
  };

  const handleLoad = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.sap';
      input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  loadProject(ev.target?.result as string);
              };
              reader.readAsText(file);
          }
      };
      input.click();
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4">
      {/* Top Bar */}
      <div className="pointer-events-auto flex items-center space-x-2 bg-black/50 p-2 rounded-lg backdrop-blur-sm text-white">
        <button
            className={clsx("p-2 rounded hover:bg-white/20", editMode && "bg-blue-600")}
            onClick={() => setEditMode(!editMode)}
            title="Edit Mode"
        >
            <MousePointer2 size={20} />
        </button>
        <div className="h-6 w-px bg-white/20 mx-2"></div>
        <button className="p-2 rounded hover:bg-white/20" onClick={handleSave} title="Save Project">
            <Save size={20} />
        </button>
        <button className="p-2 rounded hover:bg-white/20" onClick={handleLoad} title="Load Project">
            <FolderOpen size={20} />
        </button>
      </div>

      {/* Timeline / Playback Controls */}
      <div className="pointer-events-auto bg-black/50 p-4 rounded-lg backdrop-blur-sm text-white flex flex-col space-y-2">
        <div className="flex items-center space-x-4">
            <button
                className="p-2 rounded bg-blue-600 hover:bg-blue-700"
                onClick={togglePlay}
            >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <div className="text-sm font-mono">
                {currentTime.toFixed(2)}s / {currentClip.duration.toFixed(2)}s
            </div>
            <button
                className="p-2 rounded bg-green-600 hover:bg-green-700 flex items-center space-x-1"
                onClick={addKeyframe}
            >
                <Plus size={16} />
                <span>Keyframe</span>
            </button>
        </div>

        {/* Simple Timeline Visualizer */}
        <div className="w-full h-8 bg-black/30 rounded relative mt-2">
            {/* Playhead */}
            <div
                className="absolute top-0 bottom-0 w-1 bg-red-500 z-10"
                style={{ left: `${(currentTime / currentClip.duration) * 100}%` }}
            />
            {/* Keyframes */}
            {currentClip.keyframes.map((kf) => (
                <div
                    key={kf.id}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 rounded-full"
                    style={{ left: `${(kf.timestamp / currentClip.duration) * 100}%` }}
                    title={`Keyframe at ${kf.timestamp.toFixed(2)}s`}
                />
            ))}
        </div>
      </div>
    </div>
  );
};
