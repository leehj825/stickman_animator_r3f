import { create } from 'zustand';
import { StickmanSkeleton } from '../core/StickmanSkeleton';
import { StickmanClip, StickmanKeyframe } from '../core/StickmanKeyframe';
import { StickmanNode } from '../core/StickmanNode';
import { v4 as uuidv4 } from 'uuid';
import { Vector3, Quaternion } from 'three';

interface StickmanState {
  currentSkeleton: StickmanSkeleton;
  clips: StickmanClip[];
  activeClipId: string;
  isPlaying: boolean;
  currentTime: number;
  editMode: boolean;
  selectedNodeId: string | null;
  modeType: 'pose' | 'animate';

  // New SA3 Data
  skin: any;
  polygons: any;

  // View State
  cameraView: 'front' | 'side' | 'top' | 'free';
  axisMode: 'none' | 'x' | 'y' | 'z';
  viewZoom: number;
  viewHeight: number;

  // Actions
  togglePlay: () => void;
  setEditMode: (enabled: boolean) => void;
  selectNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: Vector3) => void;
  addKeyframe: () => void;
  loadProject: (json: string) => void;
  saveProject: (format?: 'sap' | 'sa3') => string;
  setCurrentTime: (time: number) => void;
  setModeType: (mode: 'pose' | 'animate') => void;

  // UI Actions
  setCameraView: (view: 'front' | 'side' | 'top' | 'free') => void;
  setAxisMode: (mode: 'none' | 'x' | 'y' | 'z') => void;
  setViewZoom: (zoom: number) => void;
  setViewHeight: (height: number) => void;
  setHeadRadius: (radius: number) => void;
  setStrokeWidth: (width: number) => void;

  // Playlist Actions
  setActiveClip: (id: string) => void;
  addClip: () => void;
  updateClipName: (id: string, name: string) => void;
}

// --- IK / FK MATH HELPERS (Ported from Dart) ---

const findNode = (root: StickmanNode, id: string): StickmanNode | null => {
    if (root.id === id) return root;
    for (const child of root.children) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};

// Hardcoded hierarchy lookup (matches StickmanSkeleton structure)
const getParentId = (nodeId: string): string => {
    if (nodeId === 'leftElbow' || nodeId === 'rightElbow') return 'neck';
    if (nodeId === 'leftKnee' || nodeId === 'rightKnee') return 'hip';
    if (nodeId === 'leftHand') return 'leftElbow';
    if (nodeId === 'rightHand') return 'rightElbow';
    if (nodeId === 'leftFoot') return 'leftKnee';
    if (nodeId === 'rightFoot') return 'rightKnee';
    if (nodeId === 'neck') return 'hip';
    if (nodeId === 'head') return 'neck';
    return '';
};

// Recursive move for root nodes (moves the whole hierarchy)
const recursiveMove = (node: StickmanNode, delta: Vector3) => {
    node.position.add(delta);
    node.children.forEach(child => recursiveMove(child, delta));
};

// FK: Moves a joint (like Elbow) but keeps it attached to parent (Neck) by radius
const applyConstrainedFKMove = (rootSkel: StickmanNode, nodeId: string, parentId: string, requestedDelta: Vector3) => {
    const node = findNode(rootSkel, nodeId);
    const parent = findNode(rootSkel, parentId);
    if (!node || !parent) return;

    const oldPos = node.position.clone();
    const targetPos = oldPos.clone().add(requestedDelta);

    // Constrain to sphere radius
    const currentLength = oldPos.distanceTo(parent.position);
    const dir = new Vector3().subVectors(targetPos, parent.position);

    if (dir.length() > 0.001) {
        dir.normalize();
        const constrainedPos = parent.position.clone().add(dir.multiplyScalar(currentLength));
        const finalDelta = new Vector3().subVectors(constrainedPos, oldPos);

        // Move this node and all children (hands/feet move with elbows/knees)
        recursiveMove(node, finalDelta);
    }
};

// IK: Solves 2-Bone IK (Hip -> Knee -> Foot)
const solveTwoBoneIK = (rootPos: Vector3, jointNode: StickmanNode, effectorNode: StickmanNode, targetPos: Vector3, len1: number, len2: number) => {
    // 1. Calculate direction from Root to Target
    const direction = new Vector3().subVectors(targetPos, rootPos);
    let distance = direction.length();

    // 2. Clamp target if out of reach
    if (distance > (len1 + len2)) {
        direction.normalize();
        targetPos.copy(rootPos).add(direction.multiplyScalar(len1 + len2));
        distance = len1 + len2;
    }

    // 3. Law of Cosines to find the angle (alpha) for the joint
    const cosAlpha = (len1 * len1 + distance * distance - len2 * len2) / (2 * len1 * distance);
    const clampedCos = Math.max(-1, Math.min(1, cosAlpha));
    const alpha = Math.acos(clampedCos);

    // 4. Determine Bending Plane (Pole Vector)
    const armAxis = direction.clone().normalize();
    let pole: Vector3 | null = null;

    // Pole vectors define which way joints bend
    if (jointNode.id.toLowerCase().includes('knee')) pole = new Vector3(0, 0, -1); // Knees bend backward
    else if (jointNode.id.toLowerCase().includes('elbow')) pole = new Vector3(0, 0, 1); // Elbows bend forward/out

    let bendNormal = new Vector3();
    if (pole) {
        bendNormal.crossVectors(armAxis, pole);
        if (bendNormal.length() < 0.001) bendNormal.crossVectors(armAxis, new Vector3(1, 0, 0));
    } else {
        // Fallback: use current joint position to determine plane
        const currentLimb = new Vector3().subVectors(jointNode.position, rootPos);
        bendNormal.crossVectors(armAxis, currentLimb);
    }

    if (bendNormal.length() < 0.001) bendNormal.set(1, 0, 0);
    bendNormal.normalize();

    // 5. Rotate the joint position
    const q = new Quaternion().setFromAxisAngle(bendNormal, alpha);
    const rotatedLimb = armAxis.clone().applyQuaternion(q).multiplyScalar(len1);

    jointNode.position.copy(rootPos).add(rotatedLimb);
    effectorNode.position.copy(targetPos);
};

const applyIKMove = (rootSkel: StickmanNode, effectorId: string, delta: Vector3) => {
    const effector = findNode(rootSkel, effectorId);
    const jointId = getParentId(effectorId);
    const rootId = getParentId(jointId);

    if (!effector || !jointId || !rootId) return;

    const joint = findNode(rootSkel, jointId);
    const root = findNode(rootSkel, rootId);

    if (!joint || !root) return;

    const len1 = joint.position.distanceTo(root.position);
    const len2 = effector.position.distanceTo(joint.position);
    const targetPos = effector.position.clone().add(delta);

    solveTwoBoneIK(root.position, joint, effector, targetPos, len1, len2);
};


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
    selectedNodeId: null,
    skin: null,
    polygons: null,
    modeType: 'pose',

    // View Defaults
    cameraView: 'free',
    axisMode: 'none',
    viewZoom: 5.0,
    viewHeight: 2.0,

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setEditMode: (enabled) => set({ editMode: enabled }),
    selectNode: (id) => set({ selectedNodeId: id }),
    setModeType: (mode) => set({ modeType: mode }),

    setCameraView: (view) => set({ cameraView: view }),
    setAxisMode: (mode) => set({ axisMode: mode }),
    setViewZoom: (zoom) => set({ viewZoom: zoom }),
    setViewHeight: (height) => set({ viewHeight: height }),

    setHeadRadius: (radius) => {
        const { currentSkeleton } = get();
        currentSkeleton.headRadius = radius;
        set({ currentSkeleton: currentSkeleton });
    },

    setStrokeWidth: (width) => {
        const { currentSkeleton } = get();
        currentSkeleton.strokeWidth = width;
        set({ currentSkeleton: currentSkeleton });
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

    // --- SMART UPDATE LOGIC ---
    updateNodePosition: (id, targetWorldPosition) => {
      const { currentSkeleton } = get();
      const node = findNode(currentSkeleton.root, id);

      if (node) {
        // Calculate the requested Move Delta
        // targetWorldPosition is absolute, so we need delta for our logic
        const delta = new Vector3().subVectors(targetWorldPosition, node.position);

        // Classify the Move Type
        const isEndEffector = ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'].includes(id);
        const isMidJoint = ['leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'].includes(id);
        const isRoot = id === 'hip';
        const isNeck = id === 'neck';
        const parentId = getParentId(id);

        if (isRoot) {
            // Move entire skeleton
            recursiveMove(node, delta);
        } else if (isNeck) {
            // Neck is attached to Hip
            applyConstrainedFKMove(currentSkeleton.root, id, 'hip', delta);
        } else if (isMidJoint && parentId) {
            // Elbow/Knee attached to Neck/Hip
            applyConstrainedFKMove(currentSkeleton.root, id, parentId, delta);
        } else if (isEndEffector) {
            // Hand/Foot uses IK
            applyIKMove(currentSkeleton.root, id, delta);
        } else {
            // Fallback for Heads or unknown nodes
            recursiveMove(node, delta);
        }

        // Force React Re-render
        set({ currentSkeleton: currentSkeleton });
      }
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
            const SCALE = isSa3 ? 1.0 : 0.25; // Adjusted as per your preference (was 0.05, let's stick to 0.25 or 1.0)
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
                if (firstClip.keyframes.length > 0) traverseAndFindMin(firstSkeleton.root);
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
        const { clips, currentSkeleton, activeClipId, skin, polygons } = get();

        if (format === 'sap') {
            // Legacy Export Logic
            const activeClip = clips.find(c => c.id === activeClipId);
            if (!activeClip) return "{}";

            const LEGACY_SCALE = 4.0; // Inverse of 0.25
            const INVERT_Y = -1.0;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const serializeNodeLegacy = (node: StickmanNode): any => ({
                id: node.id,
                // Apply Inverse Transform: x*4, y*-4, z*4
                pos: [
                    node.position.x * LEGACY_SCALE,
                    node.position.y * LEGACY_SCALE * INVERT_Y,
                    node.position.z * LEGACY_SCALE
                ],
                children: node.children.map(serializeNodeLegacy)
            });

            const data = {
                id: activeClip.id,
                name: activeClip.name,
                duration: activeClip.duration,
                headRadius: currentSkeleton.headRadius * LEGACY_SCALE,
                strokeWidth: currentSkeleton.strokeWidth * LEGACY_SCALE,
                keyframes: activeClip.keyframes.map(kf => ({
                    id: kf.id,
                    timestamp: kf.timestamp,
                    pose: {
                        root: serializeNodeLegacy(kf.skeleton.root),
                        headRadius: kf.skeleton.headRadius * LEGACY_SCALE,
                        strokeWidth: kf.skeleton.strokeWidth * LEGACY_SCALE
                    }
                }))
            };
            return JSON.stringify(data, null, 2);
        }

        // SA3 Export Logic (Default)
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
