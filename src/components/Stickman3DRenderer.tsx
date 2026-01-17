import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Sphere, Html } from '@react-three/drei';
import { useStickmanStore, CameraView } from '../store/useStickmanStore';
import { StickmanNode } from '../core/StickmanNode';
import { Object3D, Vector3, Quaternion, Euler } from 'three';
import { useRef, useMemo, useEffect } from 'react';

// --- Joint & Bone Components (Same as before but with Axis awareness) ---

const JointNode = ({ node, isSelected, onClick, radius }: { node: StickmanNode, isSelected: boolean, onClick: () => void, radius: number }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshRef = useRef<any>(null);
  const { updateNodePosition, axisMode } = useStickmanStore();

  useFrame(() => {
    if (meshRef.current) {
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
          <meshStandardMaterial color={isSelected ? "#ffff00" : "white"} />
        </Sphere>
        {isSelected && (
             <TransformControls
                object={meshRef}
                mode="translate"
                showX={axisMode === 'none' || axisMode === 'x'}
                showY={axisMode === 'none' || axisMode === 'y'}
                showZ={axisMode === 'none' || axisMode === 'z'}
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
    const selectedNodeId = useStickmanStore((state) => state.selectedNodeId);
    const selectNode = useStickmanStore((state) => state.selectNode);
    const isSelected = selectedNodeId === node.id;
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

// --- Camera Controller ---
const CameraController = () => {
    const { camera, gl } = useThree();
    const { cameraView, viewZoom, viewHeight } = useStickmanStore();
    const controlsRef = useRef<any>(null);

    useEffect(() => {
        // Reset or adjust camera based on view mode
        const dist = viewZoom; // Use zoom as distance
        const height = viewHeight;

        if (cameraView === 'front') {
            camera.position.set(0, height, dist);
            camera.lookAt(0, height, 0);
            if(controlsRef.current) controlsRef.current.reset(); // Reset orbit
        } else if (cameraView === 'side') {
            camera.position.set(dist, height, 0);
            camera.lookAt(0, height, 0);
             if(controlsRef.current) controlsRef.current.reset();
        } else if (cameraView === 'top') {
            camera.position.set(0, dist + height, 0);
            camera.lookAt(0, height, 0);
             if(controlsRef.current) controlsRef.current.reset();
        }

        // For 'free', we leave it to OrbitControls user interaction
    }, [cameraView, viewZoom, viewHeight, camera]);

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enabled={cameraView === 'free'} // Disable orbit if locked views
            enableRotate={cameraView === 'free'}
        />
    );
};

// --- Skin Placeholder (Visualizer) ---
// Renders a convex hull or just a simple mesh around the skeleton center to imply "Skin"
const SkinPlaceholder = () => {
    const currentSkeleton = useStickmanStore(state => state.currentSkeleton);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meshRef = useRef<any>(null);

    useFrame(() => {
        if(meshRef.current) {
             // Just position it at the root/hip for now as a "Body" placeholder
             if(currentSkeleton.root) {
                 meshRef.current.position.copy(currentSkeleton.root.position);
             }
        }
    });

    return (
        <mesh ref={meshRef} visible={false}>
            {/* Hidden for now, but ready for logic.
                If we wanted to show a "Ghost" skin, we could make it visible with opacity.
            */}
            <boxGeometry args={[0.5, 1.5, 0.2]} />
            <meshStandardMaterial color="cyan" transparent opacity={0.3} wireframe />
        </mesh>
    );
};

const SceneContent = () => {
    const currentSkeleton = useStickmanStore((state) => state.currentSkeleton);
    const selectNode = useStickmanStore((state) => state.selectNode);
    const { isPlaying, clips, activeClipId, currentTime, setCurrentTime } = useStickmanStore();

    // Playback Logic
    const currentClip = clips.find(c => c.id === activeClipId);
    useFrame((_state, delta) => {
        if (isPlaying && currentClip) {
            let newTime = currentTime + delta;
            if (newTime > currentClip.duration) newTime = 0;
            setCurrentTime(newTime);

            if (currentClip.keyframes.length >= 2) {
                // Interpolation logic...
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

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
            <pointLight position={[-5, 5, -5]} intensity={0.5} />

            <StickmanRecursive
                node={currentSkeleton.root}
                headRadius={currentSkeleton.headRadius}
                strokeWidth={currentSkeleton.strokeWidth}
            />

            <SkinPlaceholder />

            <CameraController />

            <gridHelper args={[20, 20, 0x444444, 0x222222]} position={[0, 0, 0]} />
            <axesHelper args={[1]} />
        </>
    );
};

// --- Main Renderer ---
export const Stickman3DRenderer = () => {
    const selectNode = useStickmanStore((state) => state.selectNode);

    return (
        <div className="w-full h-full">
            <Canvas
                camera={{ position: [0, 2, 5], fov: 50 }}
                onPointerMissed={() => selectNode(null)}
                style={{ background: '#1a1a1a' }} // Darker background for "Real 3D" feel
            >
                <SceneContent />
            </Canvas>
        </div>
    );
};
