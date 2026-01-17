import { useStickmanStore } from '../store/useStickmanStore';
import { Play, Pause, Save, FolderOpen, Plus, MousePointer2, Film, Pencil, Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useState, useRef, useEffect } from 'react';

export const EditorUI = () => {
  const {
      isPlaying, togglePlay,
      editMode, setEditMode,
      addKeyframe, currentTime,
      clips, activeClipId, setActiveClip, addClip, updateClipName,
      saveProject, loadProject
  } = useStickmanStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showClipDropdown, setShowClipDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0];

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setShowClipDropdown(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
      // Save as SA3 by default as requested
      const json = saveProject('sa3');
      const filename = `stickman_project_${Date.now()}.sa3`;
      const file = new File([json], filename, { type: 'application/json' });

      // Try Web Share API first
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
              await navigator.share({
                  files: [file],
                  title: 'Stickman Project',
                  text: 'My stickman animation project'
              });
              return;
          } catch (error) {
              console.warn('Share failed, falling back to download', error);
          }
      }

      // Fallback to Download Link
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Extension is now .sa3
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleLoad = () => {
      const input = document.createElement('input');
      input.type = 'file';
      // Added .sa3 to accepted files
      input.accept = '.json,.sap,.sa3,application/json,text/plain,application/octet-stream';
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

      {/* Top Bar Container */}
      <div className="pointer-events-auto flex flex-wrap items-start gap-4 self-start w-full">

        {/* Main Controls */}
        <div className="flex items-center space-x-2 bg-black/50 p-2 rounded-lg backdrop-blur-sm text-white">
            <button
                className={clsx("p-2 rounded hover:bg-white/20", editMode && "bg-blue-600")}
                onClick={() => setEditMode(!editMode)}
                title="Edit Mode"
            >
                <MousePointer2 size={20} />
            </button>
            <div className="h-6 w-px bg-white/20 mx-2"></div>
            <button className="p-2 rounded hover:bg-white/20" onClick={handleSave} title="Save Project (.sa3)">
                <Save size={20} />
            </button>
            <button className="p-2 rounded hover:bg-white/20" onClick={handleLoad} title="Load Project">
                <FolderOpen size={20} />
            </button>
        </div>

        {/* Animation Selector (Compact Dropdown) */}
        <div className="relative" ref={dropdownRef}>
            <div
                className="flex items-center bg-black/50 hover:bg-black/70 rounded-lg backdrop-blur-sm text-white cursor-pointer select-none"
                onClick={() => setShowClipDropdown(!showClipDropdown)}
            >
                <div className="p-3 flex items-center gap-2 min-w-[160px]">
                    <Film size={16} />
                    <span className="font-semibold truncate max-w-[150px]">{activeClip.name}</span>
                </div>
                <div className="p-3 border-l border-white/10">
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* Dropdown Menu */}
            {showClipDropdown && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-black/90 rounded-lg shadow-xl backdrop-blur-md text-white border border-white/10 z-50">
                    <div className="max-h-[300px] overflow-y-auto p-1 space-y-1">
                        {clips.map(clip => (
                            <div
                                key={clip.id}
                                className={clsx(
                                    "p-2 rounded cursor-pointer text-sm flex items-center justify-between group",
                                    clip.id === activeClipId ? "bg-blue-600" : "hover:bg-white/10"
                                )}
                                onClick={() => {
                                    setActiveClip(clip.id);
                                    setShowClipDropdown(false);
                                }}
                            >
                                {renamingId === clip.id ? (
                                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            className="bg-black/40 border border-white/20 rounded px-1 py-0.5 w-full text-xs"
                                            value={clip.name}
                                            autoFocus
                                            onChange={(e) => updateClipName(clip.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') setRenamingId(null);
                                            }}
                                        />
                                        <button
                                            className="p-1 hover:bg-white/20 rounded"
                                            onClick={() => setRenamingId(null)}
                                        >
                                            <Check size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="truncate flex-1">{clip.name}</span>
                                        <button
                                            className="p-1 hover:bg-white/20 rounded opacity-50 hover:opacity-100"
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
                            onClick={() => {
                                addClip();
                                setShowClipDropdown(false);
                            }}
                            className="w-full py-2 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 rounded text-xs uppercase font-bold transition-colors"
                         >
                             <Plus size={12} /> New Animation
                         </button>
                    </div>
                </div>
            )}
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
