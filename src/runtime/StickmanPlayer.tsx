import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import { Vector3, Quaternion } from 'three';
import { StickmanNode } from '../core/StickmanNode';
import { ParsedStickmanProject } from './parser';

// --- Pure Visual Components (No Store Dependencies) ---

const JointNode = ({ node, radius }: { node: StickmanNode, radius: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);

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
    const meshRef = useRef<THREE.Mesh>(null);
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

// --- Player Component ---

interface StickmanPlayerProps {
    projectData: ParsedStickmanProject;
    isPlaying: boolean;
    scale?: number;
    loop?: boolean;
}

export const StickmanPlayer: React.FC<StickmanPlayerProps> = ({
    projectData,
    isPlaying,
    scale = 1,
    loop = true
}) => {
    // Clone the skeleton so we don't mutate the prop directly and to have a local mutable instance
    const skeleton = useMemo(() => projectData.currentSkeleton.clone(), [projectData]);

    // We assume the first clip is the one to play
    const currentClip = projectData.clips.length > 0 ? projectData.clips[0] : null;

    // Local time tracking
    const timeRef = useRef(0);

    useFrame((_state, delta) => {
        if (isPlaying && currentClip && currentClip.keyframes.length > 0) {
            let newTime = timeRef.current + delta;

            if (newTime > currentClip.duration) {
                if (loop) {
                    newTime = 0;
                } else {
                    newTime = currentClip.duration;
                }
            }
            timeRef.current = newTime;

            if (currentClip.keyframes.length >= 2) {
                // Interpolation logic
                let prevKeyframe = currentClip.keyframes[0];
                let nextKeyframe = currentClip.keyframes[currentClip.keyframes.length - 1];

                for (let i = 0; i < currentClip.keyframes.length - 1; i++) {
                    if (currentClip.keyframes[i].timestamp <= newTime && currentClip.keyframes[i+1].timestamp >= newTime) {
                        prevKeyframe = currentClip.keyframes[i];
                        nextKeyframe = currentClip.keyframes[i+1];
                        break;
                    }
                }

                if (prevKeyframe && nextKeyframe) {
                    // Handle edge case where timestamps might be equal
                    const range = nextKeyframe.timestamp - prevKeyframe.timestamp;
                    const alpha = range > 0.0001 ? (newTime - prevKeyframe.timestamp) / range : 0;

                    // We can use the skeleton's lerp method, but it returns a NEW skeleton.
                    // We want to update our CURRENT skeleton's nodes in place to avoid React re-renders.
                    // So we do the lerp calculation but copy positions to 'skeleton'.

                    // Actually, StickmanSkeleton.lerp returns a new skeleton.
                    // Let's create a temporary lerped skeleton (computationally expensive? maybe not for one stickman).
                    // Or ideally we would have a 'lerpInto' method.
                    // But since we can't modify core, we will use the existing lerp and copy positions.

                    const interpolated = prevKeyframe.skeleton.lerp(nextKeyframe.skeleton, alpha);
                    const targetNodes = interpolated.getAllNodes();
                    const currentNodes = skeleton.getAllNodes();

                    for(let i=0; i<currentNodes.length; i++) {
                        const target = targetNodes.find(n => n.id === currentNodes[i].id);
                        if (target) {
                            currentNodes[i].position.copy(target.position);
                        }
                    }

                    // Also update global props if they animate (though usually constant per clip in this editor)
                    skeleton.headRadius = interpolated.headRadius;
                    skeleton.strokeWidth = interpolated.strokeWidth;
                }
            } else if (currentClip.keyframes.length === 1) {
                // Static pose
                 const targetNodes = currentClip.keyframes[0].skeleton.getAllNodes();
                 const currentNodes = skeleton.getAllNodes();
                 for(let i=0; i<currentNodes.length; i++) {
                     const target = targetNodes.find(n => n.id === currentNodes[i].id);
                     if (target) currentNodes[i].position.copy(target.position);
                 }
            }
        }
    });

    return (
        <group scale={scale}>
            <StickmanRecursive
                node={skeleton.root}
                headRadius={skeleton.headRadius}
                strokeWidth={skeleton.strokeWidth}
            />
        </group>
    );
};
