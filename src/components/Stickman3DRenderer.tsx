import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, Sphere } from '@react-three/drei';
import { useStickmanStore } from '../store/useStickmanStore';
import { StickmanNode } from '../core/StickmanNode';
import { Object3D, Vector3, Quaternion } from 'three';
import { useRef, useMemo } from 'react';

// JointNode: A sphere at the joint position
const JointNode = ({ node, isSelected, onClick, radius }: { node: StickmanNode, isSelected: boolean, onClick: () => void, radius: number }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshRef = useRef<any>(null);
  const { editMode, updateNodePosition } = useStickmanStore();

  useFrame(() => {
    if (meshRef.current) {
        // If transform controls are active on this node, we don't force position here
        // to avoid fighting with the controls loop.
        // Actually, TransformControls updates the object position.
        // But our state (node.position) is the source of truth.
        // If we drag, onObjectChange updates the store.
        // We sync FROM the store here.

        // However, if TransformControls is modifying this mesh directly,
        // we should let it, but update the store.

        // For simplicity: We always sync from node.position.
        // TransformControls should update node.position via the store callback,
        // which then reflects back here.
        meshRef.current.position.copy(node.position);
    }
  });

  return (
    <>
        <Sphere
            ref={meshRef}
            position={node.position}
            args={[radius, 32, 32]}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
          <meshStandardMaterial color={isSelected ? "yellow" : "white"} />
        </Sphere>
        {isSelected && editMode && (
             <TransformControls
                object={meshRef}
                mode="translate"
                onObjectChange={(e) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const object = (e?.target as any)?.object as Object3D | undefined;
                    if (object) {
                        updateNodePosition(node.id, object.position.clone());
                    }
                }}
             />
        )}
    </>
  );
};

// BoneSegment: A capsule/cylinder connecting two nodes
const BoneSegment = ({ startNode, endNode, thickness }: { startNode: StickmanNode, endNode: StickmanNode, thickness: number }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meshRef = useRef<any>(null);

    // We reuse vectors/matrices to avoid GC
    const axis = useMemo(() => new Vector3(0, 1, 0), []); // Cylinder default up axis
    const startVec = useMemo(() => new Vector3(), []);
    const endVec = useMemo(() => new Vector3(), []);
    const diffVec = useMemo(() => new Vector3(), []);
    const midVec = useMemo(() => new Vector3(), []);
    const quaternion = useMemo(() => new Quaternion(), []);

    useFrame(() => {
        if (meshRef.current) {
            startVec.copy(startNode.position);
            endVec.copy(endNode.position);

            // Calculate distance for height (length of cylinder)
            const distance = startVec.distanceTo(endVec);

            // Calculate midpoint for position
            midVec.addVectors(startVec, endVec).multiplyScalar(0.5);

            // Calculate orientation
            diffVec.subVectors(endVec, startVec).normalize();
            quaternion.setFromUnitVectors(axis, diffVec);

            // Apply to mesh
            meshRef.current.position.copy(midVec);
            meshRef.current.quaternion.copy(quaternion);
            meshRef.current.scale.set(1, distance, 1); // Scale Y is the length
        }
    });

    // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
    // We set height to 1 and scale it in useFrame
    return (
        <group>
             <mesh ref={meshRef}>
                <cylinderGeometry args={[thickness, thickness, 1, 16]} />
                <meshStandardMaterial color="white" />
            </mesh>
        </group>
    );
};

const StickmanRecursive = ({ node, headRadius, strokeWidth }: { node: StickmanNode, headRadius: number, strokeWidth: number }) => {
    const selectedNodeId = useStickmanStore((state) => state.selectedNodeId);
    const selectNode = useStickmanStore((state) => state.selectNode);

    const isSelected = selectedNodeId === node.id;

    // Determine radius for this node
    // Head node gets headRadius, others get strokeWidth (roughly same as bone thickness for joints)
    const radius = node.name === 'head' ? headRadius : strokeWidth;

    return (
        <>
            <JointNode
                node={node}
                isSelected={isSelected}
                onClick={() => selectNode(node.id)}
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

// TransformController removed as it is now integrated into JointNode

// Component to handle playback loop
const PlaybackController = () => {
    const { isPlaying, clips, activeClipId, currentTime, setCurrentTime, currentSkeleton } = useStickmanStore();

    // Derived current clip
    const currentClip = clips.find(c => c.id === activeClipId);

    useFrame((_state, delta) => {
        if (isPlaying && currentClip) {
            let newTime = currentTime + delta;
            if (newTime > currentClip.duration) {
                newTime = 0; // Loop
            }
            setCurrentTime(newTime);

            if (currentClip.keyframes.length >= 2) {
                let prevKeyframe = currentClip.keyframes[0];
                let nextKeyframe = currentClip.keyframes[currentClip.keyframes.length - 1];

                for (let i = 0; i < currentClip.keyframes.length - 1; i++) {
                    if (currentClip.keyframes[i].timestamp <= newTime && currentClip.keyframes[i+1].timestamp >= newTime) {
                        prevKeyframe = currentClip.keyframes[i];
                        nextKeyframe = currentClip.keyframes[i+1];
                        break;
                    }
                }

                if (prevKeyframe && nextKeyframe && prevKeyframe !== nextKeyframe) {
                    const range = nextKeyframe.timestamp - prevKeyframe.timestamp;
                    const alpha = range > 0 ? (newTime - prevKeyframe.timestamp) / range : 0;

                    const interpolated = prevKeyframe.skeleton.lerp(nextKeyframe.skeleton, alpha);

                     const targetNodes = interpolated.getAllNodes();
                     const currentNodes = currentSkeleton.getAllNodes();

                     for(let i=0; i<currentNodes.length; i++) {
                         const target = targetNodes.find(n => n.id === currentNodes[i].id);
                         if (target) {
                             currentNodes[i].position.copy(target.position);
                         }
                     }
                }
            }
        }
    });

    return null;
}

export const Stickman3DRenderer = () => {
    const currentSkeleton = useStickmanStore((state) => state.currentSkeleton);
    const selectNode = useStickmanStore((state) => state.selectNode);

    return (
        <div className="w-full h-full">
            <Canvas
                camera={{ position: [0, 2, 5], fov: 50 }}
                onPointerMissed={() => selectNode(null)}
                style={{ background: '#222' }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />

                <StickmanRecursive
                    node={currentSkeleton.root}
                    headRadius={currentSkeleton.headRadius}
                    strokeWidth={currentSkeleton.strokeWidth}
                />

                <PlaybackController />

                <OrbitControls makeDefault />
                <gridHelper args={[10, 10]} />
                <axesHelper args={[1]} />
            </Canvas>
        </div>
    );
};
