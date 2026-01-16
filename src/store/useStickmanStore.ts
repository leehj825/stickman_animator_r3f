import { create } from 'zustand';
import { StickmanSkeleton } from '../core/StickmanSkeleton';
import { StickmanClip, StickmanKeyframe } from '../core/StickmanKeyframe';
import { StickmanNode } from '../core/StickmanNode';
import { v4 as uuidv4 } from 'uuid';
import { Vector3 } from 'three';

interface StickmanState {
  currentSkeleton: StickmanSkeleton;
  clips: StickmanClip[];
  activeClipId: string;
  isPlaying: boolean;
  currentTime: number;
  editMode: boolean;
  selectedNodeId: string | null;

  // Actions
  togglePlay: () => void;
  setEditMode: (enabled: boolean) => void;
  selectNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: Vector3) => void;
  addKeyframe: () => void;
  loadProject: (json: string) => void;
  saveProject: () => string;
  setCurrentTime: (time: number) => void;

  // Playlist Actions
  setActiveClip: (id: string) => void;
  addClip: () => void;
  updateClipName: (id: string, name: string) => void;
}

export const useStickmanStore = create<StickmanState>((set, get) => {
  // Helper to create a default clip
  const createDefaultClip = (): StickmanClip => ({
    id: uuidv4(),
    name: 'New Animation',
    keyframes: [],
    duration: 5,
  });

  const defaultClip = createDefaultClip();

  return {
    currentSkeleton: new StickmanSkeleton(),
    clips: [defaultClip],
    activeClipId: defaultClip.id,
    isPlaying: false,
    currentTime: 0,
    editMode: true,
    selectedNodeId: null,

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    setEditMode: (enabled) => set({ editMode: enabled }),

    selectNode: (id) => set({ selectedNodeId: id }),

    setActiveClip: (id) => {
        const { clips } = get();
        const clip = clips.find(c => c.id === id);
        if (clip) {
            // Restore the first keyframe of the clip to the skeleton if it exists
            const startSkeleton = clip.keyframes.length > 0
                ? clip.keyframes[0].skeleton.clone()
                : new StickmanSkeleton();

            set({
                activeClipId: id,
                currentSkeleton: startSkeleton,
                currentTime: 0,
                isPlaying: false
            });
        }
    },

    addClip: () => {
        const newClip = createDefaultClip();
        set(state => ({
            clips: [...state.clips, newClip],
            activeClipId: newClip.id,
            currentTime: 0,
            isPlaying: false
        }));
    },

    updateClipName: (id, name) => {
        set(state => ({
            clips: state.clips.map(c => c.id === id ? { ...c, name } : c)
        }));
    },

    updateNodePosition: (id, position) => {
      const { currentSkeleton } = get();
      currentSkeleton.updateNodePosition(id, position);
      set({ currentSkeleton: currentSkeleton }); // Force update
    },

    addKeyframe: () => {
      const { currentSkeleton, clips, activeClipId, currentTime } = get();

      const activeClip = clips.find(c => c.id === activeClipId);
      if (!activeClip) return;

      const newKeyframe: StickmanKeyframe = {
        id: uuidv4(),
        skeleton: currentSkeleton.clone(),
        timestamp: currentTime,
      };

      const newKeyframes = [...activeClip.keyframes, newKeyframe].sort((a, b) => a.timestamp - b.timestamp);

      // Update duration if necessary
      const maxTimestamp = newKeyframes.length > 0 ? newKeyframes[newKeyframes.length - 1].timestamp : 0;
      const newDuration = Math.max(activeClip.duration, maxTimestamp);

      const updatedClips = clips.map(c =>
          c.id === activeClipId ? { ...c, keyframes: newKeyframes, duration: newDuration } : c
      );

      set({ clips: updatedClips });
    },

    loadProject: (json) => {
        try {
            const data = JSON.parse(json);
            const clipsData = data.clips || (data.keyframes ? [data] : []);

            if (clipsData.length === 0) return;

            // SCALING FACTORS to fix "Too Large" and "Upside Down"
            const SCALE = 0.1;
            const INVERT_Y = -1;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reconstructNode = (nodeData: any): StickmanNode => {
                const pos = new Vector3();
                if (Array.isArray(nodeData.pos)) {
                    // Apply Fix: Scale and Invert Y
                    pos.set(
                        nodeData.pos[0] * SCALE,
                        nodeData.pos[1] * SCALE * INVERT_Y,
                        nodeData.pos[2] * SCALE
                    );
                } else if (nodeData.position) {
                    pos.copy(nodeData.position);
                }
                const node = new StickmanNode(nodeData.id || nodeData.name, pos, nodeData.id);
                if (nodeData.children) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    nodeData.children.forEach((childData: any) => node.addChild(reconstructNode(childData)));
                }
                return node;
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reconstructedClips: StickmanClip[] = clipsData.map((clipData: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const keyframes = (clipData.keyframes || []).map((kf: any) => {
                    const skelData = kf.pose || kf.skeleton;
                    const skeleton = new StickmanSkeleton(
                        undefined,
                        (skelData.headRadius || data.headRadius || 6.0) * SCALE, // Scale visuals too
                        (skelData.strokeWidth || data.strokeWidth || 4.6) * SCALE
                    );
                    skeleton.root = reconstructNode(skelData.root || skelData);
                    return {
                        id: kf.id || uuidv4(),
                        timestamp: kf.timestamp || (kf.frameIndex ? kf.frameIndex / 30.0 : 0),
                        skeleton: skeleton
                    };
                });

                // Calculate exact duration from max timestamp if possible
                let duration = clipData.duration || 5.0;
                if (keyframes.length > 0) {
                     const maxTime = Math.max(...keyframes.map((k: any) => k.timestamp));
                     // If imported duration is default 5.0 but maxTime is smaller, strictly use maxTime?
                     // Or if maxTime > duration, extend it.
                     // User said "set exact animation length". So maxTime is the source of truth.
                     // We add a tiny buffer or just strict maxTime. Strict maxTime allows looping perfectly.
                     duration = maxTime > 0 ? maxTime : 5.0;
                }

                return {
                    id: clipData.id || uuidv4(),
                    name: clipData.name || "Imported Animation",
                    duration: duration,
                    keyframes: keyframes
                };
            });

            // Set State
            const firstClip = reconstructedClips[0];
            const startSkel = firstClip.keyframes.length > 0
                ? firstClip.keyframes[0].skeleton.clone()
                : new StickmanSkeleton(); // Should also apply scale to default if needed

            set({
                clips: reconstructedClips,
                activeClipId: firstClip.id,
                currentSkeleton: startSkel,
                currentTime: 0,
                isPlaying: false
            });
            console.log("Project loaded with Scale correction.");

        } catch (e) {
            console.error("Failed to load project", e);
            alert("Error loading file.");
        }
    },

    saveProject: () => {
        const { clips, currentSkeleton } = get();
        // Undo scaling for save? Or keep as new format?
        // Let's keep the R3F format as the new standard (no un-scaling).

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const serializeNode = (node: StickmanNode): any => ({
            id: node.id,
            pos: [node.position.x, node.position.y, node.position.z],
            children: node.children.map(serializeNode)
        });

        const serializedClips = clips.map(clip => ({
            ...clip,
            keyframes: clip.keyframes.map(kf => ({
                id: kf.id,
                timestamp: kf.timestamp,
                pose: {
                    root: serializeNode(kf.skeleton.root),
                    headRadius: kf.skeleton.headRadius,
                    strokeWidth: kf.skeleton.strokeWidth
                }
            }))
        }));

        return JSON.stringify({
            version: 2,
            clips: serializedClips,
            headRadius: currentSkeleton.headRadius,
            strokeWidth: currentSkeleton.strokeWidth,
        });
    },

    setCurrentTime: (time) => set({ currentTime: time }),
  };
});
