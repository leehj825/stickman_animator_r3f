import { useStickmanStore, ViewMode } from '../store/useStickmanStore';
import { Play, Pause, FolderOpen, Plus, MousePointer2, Film, Pencil, Check, ChevronDown, Share2 } from 'lucide-react';
import clsx from 'clsx';
import { useState, useRef, useEffect } from 'react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const EditorUI = () => {
  const {
      isPlaying, togglePlay,
      editMode, setEditMode,
      addKeyframe, currentTime,
      clips, activeClipId, setActiveClip, addClip, updateClipName,
      saveProject, loadProject,
      viewMode, setViewMode,
      currentSkeleton, updateSkeletonProperties
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

  const handleSave = async (format: 'sa3' | 'sap' = 'sa3') => {
      try {
          const json = saveProject(format);
          const fileName = `stickman_project_${Date.now()}.${format}`;

          if (Capacitor.isNativePlatform()) {
              // Android / iOS Logic
              try {
                  const writeResult = await Filesystem.writeFile({
                      path: fileName,
                      data: json,
                      directory: Directory.Cache,
                      encoding: Encoding.UTF8,
                  });

                  await Share.share({
                      title: 'Stickman Project',
                      text: 'Here is my stickman animation project.',
                      url: writeResult.uri,
                      dialogTitle: 'Save Project',
                  });
              } catch (err) {
                  console.error("Native Save Failed:", err);
                  alert("Save failed: " + err);
              }
              return;
          }

          // Step 1: Desktop "Save As" (File System Access API)
          // Use type assertion to avoid TS errors if types aren't available
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (typeof (window as any).showSaveFilePicker === 'function') {
              try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const handle = await (window as any).showSaveFilePicker({
                      suggestedName: fileName,
                      types: [{
                          description: 'Stickman Project',
                          accept: { 'application/json': ['.' + format] },
                      }],
                  });
                  const writable = await handle.createWritable();
                  await writable.write(json);
                  await writable.close();
                  return; // Success
              } catch (err: unknown) {
                  // Ignore AbortError (user cancelled)
                  if ((err as Error).name !== 'AbortError') {
                      console.error("FilePicker failed:", err);
                      // Fallthrough to other methods if it wasn't a user cancel?
                      // No, usually if picker fails technically we might fallback, but if user cancels we stop.
                      // Let's fallback only if it's not AbortError.
                      throw err;
                  }
                  return;
              }
          }

          // Step 2: Mobile Web / Share Sheet (navigator.share)
          let shared = false;
          // Use text/plain for broader compatibility on Android/Share Sheet
          const blob = new Blob([json], { type: 'text/plain' });

          if (navigator.share && navigator.canShare) {
             try {
                 const file = new File([blob], fileName, { type: 'text/plain' });
                 if (navigator.canShare({ files: [file] })) {
                     await navigator.share({
                         files: [file],
                         title: 'Stickman Project',
                         text: 'Here is my stickman animation project.',
                     });
                     shared = true;
                 }
             } catch (err) {
                 console.warn("Share failed/cancelled:", err);
                 // Proceed to fallback download
             }
          }

          // Step 3: Fallback (Legacy Download Link)
          if (!shared) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = fileName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
          }
      } catch (e) {
          console.error("Save failed:", e);
          alert("Save failed: " + e);
      }
  };

  const handleLoad = () => {
      const input = document.createElement('input');
      input.type = 'file';
      // Use */* to allow picking any file (fixes grayed out files on Google Drive/Android)
      input.accept = '*/*';
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

  const ViewButton = ({ mode, label }: { mode: ViewMode, label: string }) => (
      <button
          className={clsx("px-2 py-1 rounded text-xs font-bold w-6", viewMode === mode ? "bg-blue-600" : "hover:bg-white/20")}
          onClick={() => setViewMode(mode)}
      >
          {label}
      </button>
  );

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4">

      {/* LEFT Top Bar: Main Tools */}
      <div className="pointer-events-auto flex flex-col items-start gap-2 self-start w-full max-w-2xl">
        <div className="flex flex-wrap items-center gap-4">

            {/* 1. Edit / Save / Load */}
            <div className="flex items-center space-x-2 bg-black/50 p-2 rounded-lg backdrop-blur-sm text-white">
                <button
                    className={clsx("p-2 rounded hover:bg-white/20", editMode && "bg-blue-600")}
                    onClick={() => setEditMode(!editMode)}
                    title="Edit Mode"
                >
                    <MousePointer2 size={20} />
                </button>
                <div className="h-6 w-px bg-white/20 mx-2"></div>
                <button className="p-2 rounded hover:bg-white/20" onClick={() => handleSave('sa3')} title="Save / Share">
                    <Share2 size={20} />
                </button>
                <button className="p-2 rounded hover:bg-white/20" onClick={handleLoad} title="Load">
                    <FolderOpen size={20} />
                </button>
            </div>

            {/* 2. View Modes (KEPT IN LEFT TOOLBAR) */}
            <div className="flex items-center space-x-1 bg-black/50 p-2 rounded-lg backdrop-blur-sm text-white">
                <span className="text-[10px] text-white/50 mr-1 font-mono uppercase">View</span>
                <ViewButton mode="FREE" label="F" />
                <ViewButton mode="SIDE" label="X" />
                <ViewButton mode="TOP" label="Y" />
                <ViewButton mode="FRONT" label="Z" />
            </div>

            {/* 3. Animation Selector */}
            <div className="relative pointer-events-auto" ref={dropdownRef}>
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

                {showClipDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-black/90 rounded-lg shadow-xl backdrop-blur-md text-white border border-white/10 z-50">
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
                                            <button className="p-1 hover:bg-white/20 rounded" onClick={() => setRenamingId(null)}>
                                                <Check size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="truncate flex-1">{clip.name}</span>
                                            <button
                                                className="p-1 hover:bg-white/20 rounded opacity-50 hover:opacity-100"
                                                onClick={(e) => { e.stopPropagation(); setRenamingId(clip.id); }}
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
                                onClick={() => { addClip(); setShowClipDropdown(false); }}
                                className="w-full py-2 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 rounded text-xs uppercase font-bold transition-colors"
                            >
                                <Plus size={12} /> New Animation
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* RIGHT SIDE: Skeleton Settings Panel (KEPT IN TOP RIGHT) */}
      <div className="pointer-events-auto absolute top-4 right-4 bg-black/50 p-3 rounded-lg backdrop-blur-sm text-white flex flex-col gap-3 min-w-[200px]">
         <div className="text-xs font-bold text-white/50 uppercase tracking-wider border-b border-white/10 pb-1 mb-1">
            Skeleton Settings
         </div>

         {/* Head Radius */}
         <div className="flex flex-col gap-1">
             <div className="flex justify-between text-xs font-mono text-white/70">
                <span>Head Size</span>
                <span>{currentSkeleton.headRadius.toFixed(2)}</span>
             </div>
             <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={currentSkeleton.headRadius}
                onChange={(e) => updateSkeletonProperties({ headRadius: parseFloat(e.target.value) })}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
             />
         </div>

         {/* Stroke Width */}
         <div className="flex flex-col gap-1">
             <div className="flex justify-between text-xs font-mono text-white/70">
                <span>Thickness</span>
                <span>{currentSkeleton.strokeWidth.toFixed(2)}</span>
             </div>
             <input
                type="range" min="0.01" max="0.5" step="0.01"
                value={currentSkeleton.strokeWidth}
                onChange={(e) => updateSkeletonProperties({ strokeWidth: parseFloat(e.target.value) })}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
             />
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
