import { create } from 'zustand';
import { StickmanSkeleton } from '../core/StickmanSkeleton';
import { StickmanClip, StickmanKeyframe } from '../core/StickmanKeyframe';
import { StickmanNode } from '../core/StickmanNode';
import { v4 as uuidv4 } from 'uuid';
import { Vector3 } from 'three';

interface StickmanState {
  currentSkeleton: StickmanSkeleton;
  currentClip: StickmanClip;
  isPlaying: boolean;
  currentTime: number; // in seconds
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
}

export const useStickmanStore = create<StickmanState>((set, get) => ({
  currentSkeleton: new StickmanSkeleton(),
  currentClip: {
    id: uuidv4(),
    name: 'default',
    keyframes: [],
    duration: 5,
  },
  isPlaying: false,
  currentTime: 0,
  editMode: true,
  selectedNodeId: null,

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setEditMode: (enabled) => set({ editMode: enabled }),

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodePosition: (id, position) => {
    const { currentSkeleton } = get();
    currentSkeleton.updateNodePosition(id, position);
    // Force reactivity by cloning the container (lightweight)
    set({ currentSkeleton: currentSkeleton });
  },

  addKeyframe: () => {
    const { currentSkeleton, currentClip, currentTime } = get();
    const newKeyframe: StickmanKeyframe = {
      id: uuidv4(),
      skeleton: currentSkeleton.clone(),
      timestamp: currentTime,
    };
    const newKeyframes = [...currentClip.keyframes, newKeyframe].sort((a, b) => a.timestamp - b.timestamp);
    set({
      currentClip: { ...currentClip, keyframes: newKeyframes }
    });
  },

  loadProject: (json) => {
      try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = JSON.parse(json);
          // Handle generic project structure or raw legacy structure
          const clipsData = data.clips || (data.keyframes ? [data] : []);

          if (clipsData.length > 0) {
              const loadedClip = clipsData[0];

              // RECONSTRUCTION LOGIC
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const reconstructNode = (nodeData: any): StickmanNode => {
                  const pos = new Vector3();

                  // HANDLE FLUTTER .SAP FORMAT (pos: [x, y, z])
                  if (Array.isArray(nodeData.pos)) {
                      pos.set(nodeData.pos[0], nodeData.pos[1], nodeData.pos[2]);
                  }
                  // HANDLE R3F FORMAT (position: {x,y,z})
                  else if (nodeData.position) {
                      pos.copy(nodeData.position);
                  }

                  const node = new StickmanNode(nodeData.id || nodeData.name, pos, nodeData.id);

                  if (nodeData.children) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      nodeData.children.forEach((childData: any) => {
                          node.addChild(reconstructNode(childData));
                      });
                  }
                  return node;
              };

              // Reconstruct Keyframes
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const reconstructedKeyframes = loadedClip.keyframes.map((kf: any) => {
                  // Handle skeleton data inside keyframe
                  const skelData = kf.pose || kf.skeleton; // 'pose' in Dart, 'skeleton' in TS
                  const skeleton = new StickmanSkeleton(undefined,
                      skelData.headRadius || data.headRadius,
                      skelData.strokeWidth || data.strokeWidth
                  );
                  skeleton.root = reconstructNode(skelData.root || skelData);

                  return {
                      id: kf.id || uuidv4(),
                      timestamp: kf.timestamp || (kf.frameIndex ? kf.frameIndex / 30.0 : 0), // Fallback for frameIndex
                      skeleton: skeleton
                  };
              });

              const newClip: StickmanClip = {
                  id: loadedClip.id || uuidv4(),
                  name: loadedClip.name || "Imported Clip",
                  duration: loadedClip.duration || 5.0,
                  keyframes: reconstructedKeyframes
              };

              // Initial Skeleton state
              const firstFrameSkeleton = reconstructedKeyframes.length > 0 ? reconstructedKeyframes[0].skeleton.clone() : new StickmanSkeleton();

              if (data.headRadius !== undefined) firstFrameSkeleton.headRadius = data.headRadius;
              if (data.strokeWidth !== undefined) firstFrameSkeleton.strokeWidth = data.strokeWidth;

              set({
                  currentClip: newClip,
                  currentSkeleton: firstFrameSkeleton,
                  currentTime: 0
              });
              console.log("Project loaded successfully");
          }
      } catch (e) {
          console.error("Failed to load project", e);
          alert("Failed to load project file. Check console for details.");
      }
  },

  saveProject: () => {
      const { currentClip, currentSkeleton } = get();

      // Helper to serialize node to match .sap format roughly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serializeNode = (node: StickmanNode): any => ({
          id: node.id,
          pos: [node.position.x, node.position.y, node.position.z], // Save as Array for compatibility
          children: node.children.map(serializeNode)
      });

      const serializedKeyframes = currentClip.keyframes.map(kf => ({
          id: kf.id,
          timestamp: kf.timestamp,
          pose: { // Use 'pose' to match Dart logic
              root: serializeNode(kf.skeleton.root),
              headRadius: kf.skeleton.headRadius,
              strokeWidth: kf.skeleton.strokeWidth
          }
      }));

      return JSON.stringify({
          version: 1,
          headRadius: currentSkeleton.headRadius,
          strokeWidth: currentSkeleton.strokeWidth,
          clips: [{
              ...currentClip,
              keyframes: serializedKeyframes
          }]
      });
  },

  setCurrentTime: (time) => set({ currentTime: time }),
}));
