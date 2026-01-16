import { useStickmanStore } from '../store/useStickmanStore';
import { Play, Pause, Save, FolderOpen, Plus, MousePointer2, Film, Pencil, Check } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

export const EditorUI = () => {
  const {
      isPlaying, togglePlay,
      editMode, setEditMode,
      addKeyframe, currentTime,
      clips, activeClipId, setActiveClip, addClip, updateClipName,
      saveProject, loadProject
  } = useStickmanStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0];

  const handleSave = () => {
      const json = saveProject();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stickman_project_${Date.now()}.sap`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleLoad = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.sap,application/json,text/plain,application/octet-stream';
      input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => loadProject(ev.target?.result as string);
              reader.readAsText(file);
          }
      };
      input.click();
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4">

      {/* Top Bar */}
      <div className="pointer-events-auto flex items-center space-x-2 bg-black/50 p-2 rounded-lg backdrop-blur-sm text-white self-start">
        <button
            className={clsx("p-2 rounded hover:bg-white/20", editMode && "bg-blue-600")}
            onClick={() => setEditMode(!editMode)}
            title="Edit Mode"
        >
            <MousePointer2 size={20} />
        </button>
        <div className="h-6 w-px bg-white/20 mx-2"></div>
        <button className="p-2 rounded hover:bg-white/20" onClick={handleSave} title="Save">
            <Save size={20} />
        </button>
        <button className="p-2 rounded hover:bg-white/20" onClick={handleLoad} title="Load">
            <FolderOpen size={20} />
        </button>
      </div>

      {/* Right Sidebar: Animations List */}
      <div className="absolute top-16 right-4 w-56 bg-black/80 rounded-lg backdrop-blur-md text-white pointer-events-auto flex flex-col max-h-[40%]">
         <div className="p-3 border-b border-white/10 font-semibold flex items-center gap-2 text-xs uppercase tracking-wider">
            <Film size={14} /> Animations
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {clips.map(clip => (
                <div
                    key={clip.id}
                    className={clsx(
                        "p-2 rounded cursor-pointer text-sm flex items-center justify-between group",
                        clip.id === activeClipId ? "bg-blue-600" : "hover:bg-white/10"
                    )}
                    onClick={() => setActiveClip(clip.id)}
                >
                    {renamingId === clip.id ? (
                        <div className="flex items-center gap-1 w-full">
                            <input
                                className="bg-black/40 border border-white/20 rounded px-1 py-0.5 w-full text-xs"
                                value={clip.name}
                                autoFocus
                                onChange={(e) => updateClipName(clip.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setRenamingId(null);
                                }}
                            />
                            <button
                                className="p-1 hover:bg-white/20 rounded"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingId(null);
                                }}
                            >
                                <Check size={12} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="truncate flex-1">{clip.name}</span>
                            <button
                                className={clsx("p-1 hover:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity", clip.id === activeClipId && "opacity-100")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingId(clip.id);
                                }}
                                title="Rename"
                            >
                                <Pencil size={12} />
                            </button>
                        </>
                    )}
                </div>
            ))}
         </div>
         <div className="p-2 border-t border-white/10">
             <button
                onClick={addClip}
                className="w-full py-2 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 rounded text-xs uppercase font-bold transition-colors"
             >
                 <Plus size={12} /> New
             </button>
         </div>
      </div>

      {/* Bottom Bar: Timeline */}
      <div className="pointer-events-auto bg-black/50 p-4 rounded-lg backdrop-blur-sm text-white flex flex-col space-y-2 mt-auto">
        <div className="flex items-center space-x-4">
            <button className="p-2 rounded bg-blue-600 hover:bg-blue-700" onClick={togglePlay}>
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <div className="text-sm font-mono min-w-[100px]">
                {currentTime.toFixed(2)}s / {activeClip.duration.toFixed(2)}s
            </div>
            <button className="p-2 rounded bg-green-600 hover:bg-green-700 flex items-center space-x-1" onClick={addKeyframe}>
                <Plus size={16} />
                <span>Keyframe</span>
            </button>
        </div>

        {/* Timeline Visualizer */}
        <div className="w-full h-8 bg-black/30 rounded relative mt-2 overflow-hidden">
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 transition-all duration-75"
                style={{ left: `${(currentTime / activeClip.duration) * 100}%` }}
            />
            {activeClip.keyframes.map((kf) => (
                <div
                    key={kf.id}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 rounded-full hover:scale-150 transition-transform cursor-pointer"
                    style={{ left: `${(kf.timestamp / activeClip.duration) * 100}%` }}
                    title={`Keyframe at ${kf.timestamp.toFixed(2)}s`}
                />
            ))}
        </div>
      </div>
    </div>
  );
};
