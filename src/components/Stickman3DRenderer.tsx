import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Sphere } from '@react-three/drei';
import { useStickmanStore } from '../store/useStickmanStore';
import { StickmanNode } from '../core/StickmanNode';
import { Object3D, Vector3, Quaternion } from 'three';
import { useRef, useMemo, useEffect } from 'react';

const JointNode = ({ node, isSelected, onClick, radius }: { node: StickmanNode, isSelected: boolean, onClick: () => void, radius: number }) => {
  const meshRef = useRef<any>(null);
  const { editMode, updateNodePosition } = useStickmanStore();
  useFrame(() => {
    if (meshRef.current) meshRef.current.position.copy(node.position);
  });
  return (
    <>
        <Sphere ref={meshRef} position={node.position} args={[radius, 32, 32]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
          <meshStandardMaterial color={isSelected ? "yellow" : "white"} />
        </Sphere>
        {isSelected && editMode && (
             <TransformControls object={meshRef} mode="translate" onObjectChange={(e) => {
                    const object = (e?.target as any)?.object as Object3D | undefined;
                    if (object) updateNodePosition(node.id, object.position.clone());
                }}
             />
        )}
    </>
  );
};

const BoneSegment = ({ startNode, endNode, thickness }: { startNode: StickmanNode, endNode: StickmanNode, thickness: number }) => {
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
    const radius = node.name === 'head' ? headRadius : strokeWidth;

    return (
        <>
            <JointNode node={node} isSelected={isSelected} onClick={() => selectNode(node.id)} radius={radius} />
            {node.children.map((child) => (
                <group key={child.id}>
                    <BoneSegment startNode={node} endNode={child} thickness={strokeWidth} />
                    <StickmanRecursive node={child} headRadius={headRadius} strokeWidth={strokeWidth} />
                </group>
            ))}
        </>
    );
};

const PlaybackController = () => {
    const { isPlaying, clips, activeClipId, currentTime, setCurrentTime, currentSkeleton } = useStickmanStore();
    const currentClip = clips.find(c => c.id === activeClipId);

    useFrame((_state, delta) => {
        if (isPlaying && currentClip) {
            let newTime = currentTime + delta;
            if (newTime > currentClip.duration) newTime = 0;
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
                         if (target) currentNodes[i].position.copy(target.position);
                     }
                }
            }
        }
    });
    return null;
}

// Handles Camera Positioning based on ViewMode
const CameraRig = () => {
    const { viewMode } = useStickmanStore();
    const { camera } = useThree();

    useEffect(() => {
        // Center target for the stickman (approximate height 1.5)
        const target = new Vector3(0, 1.5, 0);

        if (viewMode === 'FRONT') { // Z axis
            camera.position.set(0, 1.5, 8);
            camera.lookAt(target);
        } else if (viewMode === 'SIDE') { // X axis
            camera.position.set(8, 1.5, 0);
            camera.lookAt(target);
        } else if (viewMode === 'TOP') { // Y axis
            camera.position.set(0, 10, 0);
            camera.lookAt(0, 0, 0);
        }
        // 'FREE' leaves camera as is (handled by OrbitControls)
    }, [viewMode, camera]);

    return null;
};

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
                <CameraRig />

                <OrbitControls makeDefault />
                <gridHelper args={[10, 10]} />
                <axesHelper args={[1]} />
            </Canvas>
        </div>
    );
};
