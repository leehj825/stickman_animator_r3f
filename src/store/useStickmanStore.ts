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

  // New SA3 Data
  skin: any; // Placeholder for skin data
  polygons: any; // Placeholder for polygon data

  // Actions
  togglePlay: () => void;
  setEditMode: (enabled: boolean) => void;
  selectNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: Vector3) => void;
  addKeyframe: () => void;
  loadProject: (json: string) => void;
  saveProject: (format?: 'sap' | 'sa3') => string;
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
    skin: null,
    polygons: null,

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

            // Detect Format
            const isSa3 = data.format === 'sa3' || !!data.skin || !!data.polygons;

            // Logic for SAP (Legacy) vs SA3
            // SAP: Reduce size to 1/4 (0.25), Invert Y (-1), Align to Floor
            // SA3: Native scale (1.0), Native Y (1), No Alignment needed (already saved correctly)
            const SCALE = isSa3 ? 1.0 : 0.25;
            const INVERT_Y = isSa3 ? 1.0 : -1.0;

            const clipsData = data.clips || (data.keyframes ? [data] : []);
            if (clipsData.length === 0) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reconstructNode = (nodeData: any): StickmanNode => {
                const pos = new Vector3();
                if (Array.isArray(nodeData.pos)) {
                    // Apply Scale and Invert Y
                    pos.set(
                        nodeData.pos[0] * SCALE,
                        nodeData.pos[1] * SCALE * INVERT_Y,
                        nodeData.pos[2] * SCALE
                    );
                } else if (nodeData.position) {
                    // If loading from JSON.stringify, it might be object {x,y,z}
                    // We still apply scale if it's a raw load, but usually SA3 keeps values correct
                    pos.set(
                        (nodeData.position.x || 0) * SCALE,
                        (nodeData.position.y || 0) * (isSa3 ? 1 : INVERT_Y), // Only invert if SAP
                        (nodeData.position.z || 0) * SCALE
                    );
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
                        (skelData.headRadius || data.headRadius || 0.1) * (isSa3 ? 1 : SCALE),
                        (skelData.strokeWidth || data.strokeWidth || 0.02) * (isSa3 ? 1 : SCALE)
                    );
                    skeleton.root = reconstructNode(skelData.root || skelData);
                    return {
                        id: kf.id || uuidv4(),
                        timestamp: kf.timestamp || (kf.frameIndex ? kf.frameIndex / 30.0 : 0),
                        skeleton: skeleton
                    };
                });

                let duration = clipData.duration || 5.0;
                if (keyframes.length > 0) {
                     const maxTime = Math.max(...keyframes.map((k: any) => k.timestamp));
                     duration = maxTime > 0 ? maxTime : 5.0;
                }

                return {
                    id: clipData.id || uuidv4(),
                    name: clipData.name || "Imported Animation",
                    duration: duration,
                    keyframes: keyframes
                };
            });

            // --- Post-Processing for SAP files: Align to Bottom Grid ---
            if (!isSa3 && reconstructedClips.length > 0) {
                // 1. Find the lowest Y point (minY) in the first frame of the animation
                // This assumes the first frame represents a "standing" or standard pose.
                let minY = Infinity;

                const firstClip = reconstructedClips[0];
                const firstSkeleton = firstClip.keyframes.length > 0
                    ? firstClip.keyframes[0].skeleton
                    : new StickmanSkeleton(); // Fallback if no keyframes

                const traverseAndFindMin = (node: StickmanNode) => {
                    // Assuming node.position is World/Model Space (based on project structure)
                    if (node.position.y < minY) minY = node.position.y;
                    node.children.forEach(traverseAndFindMin);
                };

                // If it's a fresh skeleton (no nodes loaded), minY stays Infinity
                if (firstClip.keyframes.length > 0) {
                    traverseAndFindMin(firstSkeleton.root);
                }

                if (minY !== Infinity) {
                    // We want the lowest point to be at Y=0 (or slightly above if stroke width?)
                    // Let's just put it exactly on 0 for now.
                    const offsetY = -minY;

                    // Apply this offset to ALL nodes in ALL keyframes to maintain animation consistency
                    reconstructedClips.forEach(clip => {
                        clip.keyframes.forEach(kf => {
                            const applyOffset = (node: StickmanNode) => {
                                node.position.y += offsetY;
                                node.children.forEach(applyOffset);
                            };
                            applyOffset(kf.skeleton.root);
                        });
                    });
                    console.log(`SAP Import: Aligned floor by moving up ${offsetY.toFixed(4)} units.`);
                }
            }

            // Set State
            const firstClip = reconstructedClips[0];
            const startSkel = firstClip.keyframes.length > 0
                ? firstClip.keyframes[0].skeleton.clone()
                : new StickmanSkeleton();

            set({
                clips: reconstructedClips,
                activeClipId: firstClip.id,
                currentSkeleton: startSkel,
                currentTime: 0,
                isPlaying: false,
                skin: data.skin || null,
                polygons: data.polygons || null
            });
            console.log(`Project loaded (${isSa3 ? 'SA3' : 'SAP Legacy'}).`);

        } catch (e) {
            console.error("Failed to load project", e);
            alert("Error loading file.");
        }
    },

    saveProject: (format = 'sa3') => {
        const { clips, currentSkeleton, skin, polygons } = get();

        // Serialize Nodes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const serializeNode = (node: StickmanNode): any => ({
            id: node.id,
            // Save full precision positions
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

        const data = {
            format: format,
            version: 3,
            clips: serializedClips,
            headRadius: currentSkeleton.headRadius,
            strokeWidth: currentSkeleton.strokeWidth,
            skin: skin || {},      // Save placeholder or existing skin
            polygons: polygons || [] // Save placeholder or existing polygons
        };

        return JSON.stringify(data, null, 2);
    },

    setCurrentTime: (time) => set({ currentTime: time }),
  };
});
