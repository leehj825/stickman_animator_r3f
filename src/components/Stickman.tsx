import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import { StickmanNode } from '../core/StickmanNode';
import { StickmanSkeleton } from '../core/StickmanSkeleton';
import { StickmanProjectData } from '../core/loader';
import { Vector3, Quaternion } from 'three';
import { useRef, useMemo, useState, useEffect } from 'react';

// --- Pure Joint & Bone Components ---

const JointNode = ({ node, radius }: { node: StickmanNode, radius: number }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshRef = useRef<any>(null);

  useFrame(() => {
    if (meshRef.current) {
        meshRef.current.position.copy(node.position);
    }
  });

  return (
    <Sphere
        ref={meshRef}
        position={node.position}
        args={[radius, 32, 32]}
    >
      <meshStandardMaterial color="white" />
    </Sphere>
  );
};

const BoneSegment = ({ startNode, endNode, thickness }: { startNode: StickmanNode, endNode: StickmanNode, thickness: number }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meshRef = useRef<any>(null);
    const axis = useMemo(() => new Vector3(0, 1, 0), []);
    const startVec = useMemo(() => new Vector3(), []);
    const endVec = useMemo(() => new Vector3(), []);
    const diffVec = useMemo(() => new Vector3(), []);
    const midVec = useMemo(() => new Vector3(), []);
    const quaternion = useMemo(() => new Quaternion(), []);

    useFrame(() => {
        if (meshRef.current) {
            startVec.copy(startNode.position);
            endVec.copy(endNode.position);
            const distance = startVec.distanceTo(endVec);
            midVec.addVectors(startVec, endVec).multiplyScalar(0.5);
            diffVec.subVectors(endVec, startVec).normalize();
            quaternion.setFromUnitVectors(axis, diffVec);
            meshRef.current.position.copy(midVec);
            meshRef.current.quaternion.copy(quaternion);
            meshRef.current.scale.set(1, distance, 1);
        }
    });

    return (
        <mesh ref={meshRef}>
            <cylinderGeometry args={[thickness, thickness, 1, 16]} />
            <meshStandardMaterial color="white" />
        </mesh>
    );
};

const StickmanRecursive = ({ node, headRadius, strokeWidth }: { node: StickmanNode, headRadius: number, strokeWidth: number }) => {
    const radius = node.name === 'head' ? headRadius : strokeWidth;

    return (
        <>
            <JointNode
                node={node}
                radius={radius}
            />
            {node.children.map((child) => (
                <group key={child.id}>
                    <BoneSegment startNode={node} endNode={child} thickness={strokeWidth} />
                    <StickmanRecursive node={child} headRadius={headRadius} strokeWidth={strokeWidth} />
                </group>
            ))}
        </>
    );
};

// --- Main Library Component ---

interface StickmanProps {
    projectData: StickmanProjectData | null;
    autoPlay?: boolean;
    scale?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    position?: any; // Vector3 or [x,y,z]
    clipName?: string; // Optional: play specific clip by name
}

export const Stickman = ({ projectData, autoPlay = true, scale = 1, position = [0,0,0], clipName }: StickmanProps) => {
    const [currentSkeleton, setCurrentSkeleton] = useState<StickmanSkeleton | null>(null);
    const [currentTime, setCurrentTime] = useState(0);

    // Initialize from project data
    useEffect(() => {
        if (projectData && projectData.currentSkeleton) {
            // Clone to avoid mutating original data during playback
            setCurrentSkeleton(projectData.currentSkeleton.clone());
        }
    }, [projectData]);

    useFrame((_state, delta) => {
        if (autoPlay && projectData && currentSkeleton && projectData.clips.length > 0) {
            // Determine active clip
            let activeClip = projectData.clips[0];
            if (clipName) {
                const found = projectData.clips.find(c => c.name === clipName);
                if (found) activeClip = found;
            }

            let newTime = currentTime + delta;
            if (newTime > activeClip.duration) newTime = 0;
            setCurrentTime(newTime);

            if (activeClip.keyframes.length >= 2) {
                 let prevKeyframe = activeClip.keyframes[0];
                let nextKeyframe = activeClip.keyframes[activeClip.keyframes.length - 1];

                for (let i = 0; i < activeClip.keyframes.length - 1; i++) {
                    if (activeClip.keyframes[i].timestamp <= newTime && activeClip.keyframes[i+1].timestamp >= newTime) {
                        prevKeyframe = activeClip.keyframes[i];
                        nextKeyframe = activeClip.keyframes[i+1];
                        break;
                    }
                }

                if (prevKeyframe && nextKeyframe && prevKeyframe !== nextKeyframe) {
                    const range = nextKeyframe.timestamp - prevKeyframe.timestamp;
                    const alpha = range > 0 ? (newTime - prevKeyframe.timestamp) / range : 0;

                    // We need to lerp and update our LOCAL currentSkeleton state
                    // Note: StickmanSkeleton.lerp returns a NEW skeleton
                    // But for performance in R3F loop, we should update in place if possible
                    // However, our `StickmanRecursive` binds to `node` objects.
                    // If we replace the skeleton object, we might force full re-renders if not careful.
                    // Better approach: Update the position of nodes in `currentSkeleton` directly.

                    // Since we can't easily get the result of lerp without creating new objects (based on existing logic),
                    // let's compute the interpolated values and apply them to currentSkeleton.

                    const interpolated = prevKeyframe.skeleton.lerp(nextKeyframe.skeleton, alpha);
                    const targetNodes = interpolated.getAllNodes();
                    const currentNodes = currentSkeleton.getAllNodes();

                    for(let i=0; i<currentNodes.length; i++) {
                         // Assuming order is preserved (it should be for same structure)
                         // Or find by ID
                         const target = targetNodes.find(n => n.id === currentNodes[i].id);
                         if (target) currentNodes[i].position.copy(target.position);
                    }
                }
            }
        }
    });

    if (!projectData || !currentSkeleton) return null;

    return (
        <group position={position} scale={scale}>
            <StickmanRecursive
                node={currentSkeleton.root}
                headRadius={currentSkeleton.headRadius}
                strokeWidth={currentSkeleton.strokeWidth}
            />
        </group>
    );
};
