import { create } from 'zustand';
import { StickmanSkeleton } from '../core/StickmanSkeleton';
import { StickmanClip, StickmanKeyframe } from '../core/StickmanKeyframe';
import { StickmanNode } from '../core/StickmanNode';
import { v4 as uuidv4 } from 'uuid';
import { Vector3 } from 'three';

export type CameraView = 'front' | 'side' | 'top' | 'free';
export type AxisMode = 'none' | 'x' | 'y' | 'z';

interface StickmanState {
  currentSkeleton: StickmanSkeleton;
  clips: StickmanClip[];
  activeClipId: string;
  isPlaying: boolean;
  currentTime: number;
  editMode: boolean; // True = Animate/Pose mode logic
  modeType: 'pose' | 'animate'; // Distinct mode selector
  selectedNodeId: string | null;
  skin: any;
  polygons: any;

  // View State
  cameraView: CameraView;
  axisMode: AxisMode;
  viewZoom: number;   // Acts as Distance multiplier
  viewHeight: number; // Y-offset for camera target

  // Actions
  togglePlay: () => void;
  setModeType: (mode: 'pose' | 'animate') => void;
  selectNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: Vector3) => void;
  addKeyframe: () => void;
  loadProject: (json: string) => void;
  saveProject: (format?: 'sap' | 'sa3') => string;
  setCurrentTime: (time: number) => void;

  // UI Actions
  setCameraView: (view: CameraView) => void;
  setAxisMode: (mode: AxisMode) => void;
  setViewZoom: (zoom: number) => void;
  setViewHeight: (height: number) => void;
  setHeadRadius: (radius: number) => void;
  setStrokeWidth: (width: number) => void;

  // Playlist Actions
  setActiveClip: (id: string) => void;
  addClip: () => void;
  updateClipName: (id: string, name: string) => void;
}

export const useStickmanStore = create<StickmanState>((set, get) => {
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
    modeType: 'pose',
    selectedNodeId: null,
    skin: null,
    polygons: null,

    // Default View State
    cameraView: 'free',
    axisMode: 'none',
    viewZoom: 5.0, // Default distance
    viewHeight: 2.0, // Default height

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    setModeType: (mode) => set({ modeType: mode, editMode: true }), // Always edit enabled for now

    selectNode: (id) => set({ selectedNodeId: id }),

    setCameraView: (view) => set({ cameraView: view }),
    setAxisMode: (mode) => set({ axisMode: mode }),
    setViewZoom: (zoom) => set({ viewZoom: zoom }),
    setViewHeight: (height) => set({ viewHeight: height }),

    setHeadRadius: (radius) => {
        const { currentSkeleton } = get();
        // Clone to ensure re-render if using strict equality checks in selectors
        const newSkeleton = currentSkeleton.clone();
        newSkeleton.headRadius = radius;
        set({ currentSkeleton: newSkeleton });
    },

    setStrokeWidth: (width) => {
        const { currentSkeleton } = get();
        const newSkeleton = currentSkeleton.clone();
        newSkeleton.strokeWidth = width;
        set({ currentSkeleton: newSkeleton });
    },

    setActiveClip: (id) => {
        const { clips } = get();
        const clip = clips.find(c => c.id === id);
        if (clip) {
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
      set({ currentSkeleton: currentSkeleton });
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
            const isSa3 = data.format === 'sa3' || !!data.skin || !!data.polygons;

            const SCALE = isSa3 ? 1.0 : 0.05;
            const INVERT_Y = isSa3 ? 1.0 : -1.0;

            const clipsData = data.clips || (data.keyframes ? [data] : []);
            if (clipsData.length === 0) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reconstructNode = (nodeData: any): StickmanNode => {
                const pos = new Vector3();
                if (Array.isArray(nodeData.pos)) {
                    pos.set(
                        nodeData.pos[0] * SCALE,
                        nodeData.pos[1] * SCALE * INVERT_Y,
                        nodeData.pos[2] * SCALE
                    );
                } else if (nodeData.position) {
                    pos.set(
                        (nodeData.position.x || 0) * SCALE,
                        (nodeData.position.y || 0) * (isSa3 ? 1 : INVERT_Y),
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
                    const baseHead = (skelData.headRadius || data.headRadius || 6.0);
                    const baseStroke = (skelData.strokeWidth || data.strokeWidth || 4.6);

                    const skeleton = new StickmanSkeleton(
                        undefined,
                        baseHead * SCALE,
                        baseStroke * SCALE
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

            if (!isSa3 && reconstructedClips.length > 0) {
                let minY = Infinity;
                const firstClip = reconstructedClips[0];
                const firstSkeleton = firstClip.keyframes.length > 0
                    ? firstClip.keyframes[0].skeleton
                    : new StickmanSkeleton();

                const traverseAndFindMin = (node: StickmanNode) => {
                    if (node.position.y < minY) minY = node.position.y;
                    node.children.forEach(traverseAndFindMin);
                };

                if (firstClip.keyframes.length > 0) {
                    traverseAndFindMin(firstSkeleton.root);
                }

                if (minY !== Infinity) {
                    const offsetY = -minY;
                    reconstructedClips.forEach(clip => {
                        clip.keyframes.forEach(kf => {
                            const applyOffset = (node: StickmanNode) => {
                                node.position.y += offsetY;
                                node.children.forEach(applyOffset);
                            };
                            applyOffset(kf.skeleton.root);
                        });
                    });
                }
            }

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

        } catch (e) {
            console.error("Failed to load project", e);
            alert("Error loading file.");
        }
    },

    saveProject: (format = 'sa3') => {
        const { clips, currentSkeleton, skin, polygons } = get();

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

        const data = {
            format: format,
            version: 3,
            clips: serializedClips,
            headRadius: currentSkeleton.headRadius,
            strokeWidth: currentSkeleton.strokeWidth,
            skin: skin || {},
            polygons: polygons || []
        };

        return JSON.stringify(data, null, 2);
    },

    setCurrentTime: (time) => set({ currentTime: time }),
  };
});
