import { useStickmanStore, CameraView, AxisMode } from '../store/useStickmanStore';
import { Play, Pause, Plus, MousePointer2, Film, Check, ChevronDown, Share2, FolderOpen, Save } from 'lucide-react';
import clsx from 'clsx';
import { useState, useRef, useEffect } from 'react';

// Vertical Slider Component
const VerticalSlider = ({ value, min, max, onChange, label }: { value: number, min: number, max: number, onChange: (v: number) => void, label: string }) => {
    return (
        <div className="flex flex-col items-center h-[120px] mb-2">
            <span className="text-[10px] text-white/70 mb-1">{label}</span>
            <div className="h-full w-4 relative flex justify-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.01}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute w-[100px] h-4 origin-center -rotate-90 top-[40px] appearance-none bg-white/20 rounded-full outline-none cursor-pointer"
                    style={{
                         // Custom style for track if needed, handled by Tailwind bg-white/20
                    }}
                />
            </div>
        </div>
    );
};

// Mini Button for View/Axis
const MiniBtn = ({ label, active, color, onClick }: { label: string, active: boolean, color: string, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={clsx(
            "w-7 h-7 flex items-center justify-center rounded border border-white/20 text-xs font-bold transition-all mb-1",
            active ? "text-white" : "text-white/70 hover:bg-white/10"
        )}
        style={{ backgroundColor: active ? color : 'transparent' }}
    >
        {label}
    </button>
);

export const EditorUI = () => {
  const {
      isPlaying, togglePlay,
      modeType, setModeType,
      addKeyframe, currentTime,
      clips, activeClipId, setActiveClip, addClip, updateClipName,
      saveProject, loadProject,
      currentSkeleton,
      cameraView, setCameraView,
      axisMode, setAxisMode,
      viewZoom, setViewZoom,
      viewHeight, setViewHeight,
      setHeadRadius, setStrokeWidth
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
      const json = saveProject('sa3');
      const fileName = `stickman_project_${Date.now()}.sa3`;
      const file = new File([json], fileName, { type: 'application/json' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
              await navigator.share({
                  title: 'Stickman Project',
                  text: 'Here is my stickman animation project.',
                  files: [file],
              });
              return;
          } catch (error) {
              console.warn("Share failed", error);
          }
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleLoad = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.sap,.sa3,application/json';
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
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between">

      {/* Top Mode Switcher */}
      <div className="pointer-events-auto absolute top-2 left-0 right-0 flex justify-center">
          <div className="flex bg-black/60 backdrop-blur-md rounded-full px-1 py-1">
              <button
                  onClick={() => setModeType('pose')}
                  className={clsx("px-4 py-1 rounded-full text-sm font-bold transition-all", modeType === 'pose' ? "bg-cyan-600 text-white" : "text-white/60 hover:text-white")}
              >
                  Pose
              </button>
              <div className="w-px bg-white/20 mx-1 my-2"></div>
              <button
                  onClick={() => setModeType('animate')}
                  className={clsx("px-4 py-1 rounded-full text-sm font-bold transition-all", modeType === 'animate' ? "bg-purple-600 text-white" : "text-white/60 hover:text-white")}
              >
                  Animate
              </button>
          </div>
      </div>

      {/* Left Panel: Camera Controls */}
      <div className="pointer-events-auto absolute top-14 left-2 flex flex-col gap-2 w-12">
          {/* Views */}
          <div className="bg-black/60 backdrop-blur-md rounded-lg p-1 flex flex-col items-center">
              <MiniBtn label="F" active={cameraView === 'free'} color="#3b82f6" onClick={() => setCameraView('free')} />
              <MiniBtn label="X" active={cameraView === 'side'} color="#ef4444" onClick={() => setCameraView('side')} />
              <MiniBtn label="Y" active={cameraView === 'top'} color="#22c55e" onClick={() => setCameraView('top')} />
              <MiniBtn label="Z" active={cameraView === 'front'} color="#3b82f6" onClick={() => setCameraView('front')} />
          </div>

          {/* Sliders */}
          <div className="bg-black/60 backdrop-blur-md rounded-lg p-1 flex flex-col items-center">
              <VerticalSlider label="Hgt" value={viewHeight} min={-5} max={10} onChange={setViewHeight} />
              <VerticalSlider label="Zm" value={viewZoom} min={1} max={20} onChange={setViewZoom} />
          </div>
      </div>

      {/* Right Panel: Axis & Style Controls */}
      <div className="pointer-events-auto absolute top-14 right-2 flex flex-col gap-2 w-12">
          {/* Axis */}
          <div className="bg-black/60 backdrop-blur-md rounded-lg p-1 flex flex-col items-center">
              <MiniBtn label="F" active={axisMode === 'none'} color="#f59e0b" onClick={() => setAxisMode('none')} />
              <MiniBtn label="X" active={axisMode === 'x'} color="#ef4444" onClick={() => setAxisMode('x')} />
              <MiniBtn label="Y" active={axisMode === 'y'} color="#22c55e" onClick={() => setAxisMode('y')} />
              <MiniBtn label="Z" active={axisMode === 'z'} color="#3b82f6" onClick={() => setAxisMode('z')} />
          </div>

          {/* Style Sliders */}
          <div className="bg-black/60 backdrop-blur-md rounded-lg p-1 flex flex-col items-center">
              <VerticalSlider label="Head" value={currentSkeleton.headRadius} min={0.1} max={1.0} onChange={setHeadRadius} />
              <VerticalSlider label="Line" value={currentSkeleton.strokeWidth} min={0.01} max={0.3} onChange={setStrokeWidth} />
          </div>
      </div>

      {/* Bottom Bar: Timeline & Tools */}
      <div className="pointer-events-auto mt-auto m-2 bg-black/60 backdrop-blur-md rounded-xl p-3 text-white">

        {/* Playback & Keyframes (Animate Mode) */}
        {modeType === 'animate' && (
            <div className="flex flex-col gap-2 mb-2 border-b border-white/10 pb-2">
                {/* Clips Selector */}
                <div className="relative" ref={dropdownRef}>
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1 rounded"
                        onClick={() => setShowClipDropdown(!showClipDropdown)}
                    >
                         <Film size={14} className="text-purple-400"/>
                         <span className="text-xs font-bold uppercase">{activeClip.name}</span>
                         <ChevronDown size={12} />
                    </div>
                     {/* Dropdown Menu */}
                    {showClipDropdown && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-black/90 rounded-lg shadow-xl border border-white/10 p-1 max-h-[200px] overflow-y-auto">
                            {clips.map(clip => (
                                <div key={clip.id}
                                    className={clsx("p-2 text-xs rounded hover:bg-white/20 cursor-pointer", clip.id === activeClipId && "bg-purple-600")}
                                    onClick={() => { setActiveClip(clip.id); setShowClipDropdown(false); }}
                                >
                                    {clip.name}
                                </div>
                            ))}
                            <div className="border-t border-white/10 mt-1 pt-1">
                                <button onClick={addClip} className="w-full text-left p-2 text-xs hover:bg-white/20 text-green-400 flex items-center gap-1">
                                    <Plus size={12}/> New Animation
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Timeline Controls */}
                <div className="flex items-center gap-3">
                    <button onClick={togglePlay} className="hover:text-purple-400">
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>

                    <div className="flex-1 flex flex-col justify-center h-8 relative bg-black/30 rounded px-2">
                         {/* Progress Bar */}
                         <div className="absolute top-0 bottom-0 left-0 bg-white/5 w-full pointer-events-none"/>
                         <div
                            className="absolute top-0 bottom-0 left-0 bg-purple-600/30 transition-all duration-75"
                            style={{ width: `${(currentTime / activeClip.duration) * 100}%` }}
                         />

                         {/* Keyframes Dots */}
                         {activeClip.keyframes.map(kf => (
                             <div
                                key={kf.id}
                                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-sm"
                                style={{ left: `${(kf.timestamp / activeClip.duration) * 100}%` }}
                             />
                         ))}

                         {/* Playhead */}
                         <div
                             className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 transition-all duration-75"
                             style={{ left: `${(currentTime / activeClip.duration) * 100}%` }}
                         />
                    </div>

                    <div className="text-xs font-mono w-16 text-right">
                        {currentTime.toFixed(2)}s
                    </div>
                </div>

                 <div className="flex justify-between items-center">
                    <button
                        onClick={addKeyframe}
                        className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"
                    >
                        <Plus size={12}/> Keyframe
                    </button>
                 </div>
            </div>
        )}

        {/* Toolbar (Common) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
             <button className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-xs" onClick={handleSave}>
                 <Share2 size={12}/> Save / Share
             </button>
             <button className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-xs" onClick={handleLoad}>
                 <FolderOpen size={12}/> Load
             </button>
             {/* OBJ Export Placeholder */}
             <button className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-xs text-white/50 cursor-not-allowed">
                 OBJ
             </button>
        </div>

      </div>
    </div>
  );
};
