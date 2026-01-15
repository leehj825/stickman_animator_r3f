import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, Line, Sphere } from '@react-three/drei';
import { useStickmanStore } from '../store/useStickmanStore';
import { StickmanNode } from '../core/StickmanNode';
import { Object3D } from 'three';
import { useRef } from 'react';

const StickmanJoint = ({ node, isSelected, onClick }: { node: StickmanNode, isSelected: boolean, onClick: () => void }) => {
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
        args={[0.1, 16, 16]}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
    >
      <meshStandardMaterial color={isSelected ? "yellow" : "white"} />
    </Sphere>
  );
};

const StickmanBone = ({ startNode, endNode }: { startNode: StickmanNode, endNode: StickmanNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineRef = useRef<any>(null);

    useFrame(() => {
        if (lineRef.current) {
            // Line component from Drei might need points update slightly differently depending on version,
            // but typically modifying the points prop works if it re-renders, OR we access the underlying geometry.
            // However, Drei Line uses Line2 which is complex.
            // Re-rendering Lines is heavy. Let's try to pass a mutable buffer or just force update.
            // Actually, for Drei Line, the easiest way to animate is usually just passing new props if React is fast enough,
            // or accessing the geometry.

            // To keep it simple and performant enough for a stickman (low count), we can let the parent re-render,
            // OR we can rely on the fact that if we update the nodes, we need to signal the line to update.

            // Since StickmanJoint uses useFrame to update position, the React component itself doesn't re-render.
            // So the Line component won't receive new props.
            // We need to update the line geometry manually.

            // NOTE: Drei's <Line> is a wrapper around Line2. updating geometry.setPositions is needed.
            const geometry = lineRef.current.geometry;
            if (geometry) {
                geometry.setPositions([
                    startNode.position.x, startNode.position.y, startNode.position.z,
                    endNode.position.x, endNode.position.y, endNode.position.z
                ]);
            }
        }
    });

    return (
        <Line
            ref={lineRef}
            points={[startNode.position, endNode.position]}
            color="white"
            lineWidth={2}
        />
    );
};

const StickmanRecursive = ({ node }: { node: StickmanNode }) => {
    const selectedNodeId = useStickmanStore((state) => state.selectedNodeId);
    const selectNode = useStickmanStore((state) => state.selectNode);

    const isSelected = selectedNodeId === node.id;

    return (
        <>
            <StickmanJoint
                node={node}
                isSelected={isSelected}
                onClick={() => selectNode(node.id)}
            />
            {node.children.map((child) => (
                <group key={child.id}>
                    <StickmanBone startNode={node} endNode={child} />
                    <StickmanRecursive node={child} />
                </group>
            ))}
        </>
    );
};

const TransformController = () => {
    const { currentSkeleton, selectedNodeId, updateNodePosition, editMode } = useStickmanStore();

    if (!selectedNodeId || !editMode) return null;

    const selectedNode = currentSkeleton.root.findNode(selectedNodeId);
    if (!selectedNode) return null;

    return (
        <TransformControls
            position={selectedNode.position}
            onObjectChange={(e) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const object = (e?.target as any)?.object as Object3D | undefined;
                if (object) {
                    updateNodePosition(selectedNodeId, object.position.clone());
                }
            }}
            mode="translate"
        />
    );
};

// Component to handle playback loop
const PlaybackController = () => {
    const { isPlaying, currentClip, currentTime, setCurrentTime, currentSkeleton } = useStickmanStore();

    useFrame((_state, delta) => {
        if (isPlaying) {
            let newTime = currentTime + delta;
            if (newTime > currentClip.duration) {
                newTime = 0; // Loop
            }
            setCurrentTime(newTime);

            // Simple Linear Interpolation between keyframes
            if (currentClip.keyframes.length >= 2) {
                // Find prev and next keyframes
                // This is a naive implementation.
                // Assuming sorted keyframes.

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
                    const alpha = (newTime - prevKeyframe.timestamp) / range;

                    // TODO: The lerp method in Skeleton updates 'this', but here we are modifying the currentSkeleton in store.
                    // We need to carefully manage this. Ideally, we calculate a *new* skeleton state and display that.
                    // But our store 'currentSkeleton' is the single source of truth for display.

                    // For playback, we should likely display a computed skeleton, not edit the 'current' one if 'current' implies 'edit state'.
                    // But for simplicity in this port, we will lerp the current skeleton.

                    // Actually, StickmanSkeleton.lerp returns a NEW skeleton.
                    const interpolated = prevKeyframe.skeleton.lerp(nextKeyframe.skeleton, alpha);

                    // We need to update the store's skeleton to match this interpolated one for rendering
                    // But this overrides user edits if they are editing while playing.
                    // Let's assume you can't edit while playing properly without pausing.

                    // COPY positions from interpolated to currentSkeleton
                    // This is inefficient but works for now.
                     const targetNodes = interpolated.getAllNodes();
                     const currentNodes = currentSkeleton.getAllNodes();

                     for(let i=0; i<currentNodes.length; i++) {
                         // match by ID
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

export const StickmanRenderer = () => {
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

                <StickmanRecursive node={currentSkeleton.root} />

                <TransformController />
                <PlaybackController />

                <OrbitControls makeDefault />
                <gridHelper args={[10, 10]} />
                <axesHelper args={[1]} />
            </Canvas>
        </div>
    );
};
