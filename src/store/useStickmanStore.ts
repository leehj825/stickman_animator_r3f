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
    duration: 5, // default 5 seconds
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
    // We modify the current skeleton directly for performance in this demo,
    // but in a real app we might want immutability.
    // However, since StickmanSkeleton is a class, we need to trigger a re-render
    // or use a strategy to notify subscribers.
    // Here we will clone for React reactivity if needed, or just notify.

    // Actually, let's mutate and create a new reference to trigger update
    currentSkeleton.updateNodePosition(id, position);

    // For Zustand to pick up the change, we might need to shallow clone the skeleton container
    // or just rely on R3F useFrame to pick up changes if we are not strictly reactive on the skeleton structure.
    // But for the Editor UI, we probably want reactivity.

    // Let's create a new skeleton reference wrapper if needed, but for now:
    // We are mutating the deep object. To trigger re-render in UI:
    set({ currentSkeleton: currentSkeleton });
  },

  addKeyframe: () => {
    const { currentSkeleton, currentClip, currentTime } = get();
    const newKeyframe: StickmanKeyframe = {
      id: uuidv4(),
      skeleton: currentSkeleton.clone(),
      timestamp: currentTime,
    };

    // Insert sorted by time
    const newKeyframes = [...currentClip.keyframes, newKeyframe].sort((a, b) => a.timestamp - b.timestamp);

    set({
      currentClip: {
        ...currentClip,
        keyframes: newKeyframes
      }
    });
  },

  loadProject: (json) => {
      try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = JSON.parse(json);

          if (data.clips && Array.isArray(data.clips) && data.clips.length > 0) {
              const loadedClip = data.clips[0]; // Load the first clip for now

              // Reconstruct keysframes and skeletons
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const reconstructedKeyframes = loadedClip.keyframes.map((kf: any) => {
                  // Reconstruct with global properties if available in the clip or keyframe data?
                  // The prompt implies properties might be top-level or on the skeleton.
                  // For now, we use defaults or load if saved on skeleton.
                  const skeleton = new StickmanSkeleton(undefined, kf.skeleton.headRadius, kf.skeleton.strokeWidth);

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const reconstructNode = (nodeData: any): StickmanNode => {
                      const pos = new Vector3(nodeData.position.x, nodeData.position.y, nodeData.position.z);
                      const node = new StickmanNode(nodeData.name, pos, nodeData.id);
                      if (nodeData.children) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          nodeData.children.forEach((childData: any) => {
                              node.addChild(reconstructNode(childData));
                          });
                      }
                      return node;
                  };

                  skeleton.root = reconstructNode(kf.skeleton.root);
                  return {
                      id: kf.id,
                      timestamp: kf.timestamp,
                      skeleton: skeleton
                  };
              });

              const newClip: StickmanClip = {
                  id: loadedClip.id,
                  name: loadedClip.name,
                  duration: loadedClip.duration,
                  keyframes: reconstructedKeyframes
              };

              // Update current skeleton to match the first frame, ensuring properties are set
              const firstFrameSkeleton = reconstructedKeyframes.length > 0 ? reconstructedKeyframes[0].skeleton : new StickmanSkeleton();
              const newCurrentSkeleton = firstFrameSkeleton.clone();

              // If global properties were in the JSON root (as implied by "{ clips: [], headRadius: 6.0 ... }")
              // we should override them.
              if (data.headRadius !== undefined) newCurrentSkeleton.headRadius = data.headRadius;
              if (data.strokeWidth !== undefined) newCurrentSkeleton.strokeWidth = data.strokeWidth;

              set({
                  currentClip: newClip,
                  currentSkeleton: newCurrentSkeleton,
                  currentTime: 0
              });

              console.log("Project loaded successfully");
          }
      } catch (e) {
          console.error("Failed to load project", e);
      }
  },

  saveProject: () => {
      const { currentClip, currentSkeleton } = get();
      // Serialization logic
      return JSON.stringify({
          clips: [currentClip],
          headRadius: currentSkeleton.headRadius,
          strokeWidth: currentSkeleton.strokeWidth,
      });
  },

  setCurrentTime: (time) => set({ currentTime: time }),
}));
