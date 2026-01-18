import { StickmanSkeleton } from '../core/StickmanSkeleton';
import { StickmanClip } from '../core/StickmanKeyframe';
import { StickmanNode } from '../core/StickmanNode';
import { Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedStickmanProject {
  clips: StickmanClip[];
  currentSkeleton: StickmanSkeleton;
  meta: {
    skin?: any;
    polygons?: any;
    headRadius?: number;
    strokeWidth?: number;
  };
}

export function parseStickmanProject(json: string): ParsedStickmanProject {
  try {
    const data = JSON.parse(json);
    const isSa3 = data.format === 'sa3' || !!data.skin || !!data.polygons;
    let SCALE = 1.0;
    let verticalOffset = 0.0;
    const INVERT_Y = isSa3 ? 1.0 : -1.0;

    const clipsData = data.clips || (data.keyframes ? [data] : []);

    // Default skeleton to return if no clips
    let currentSkeleton = new StickmanSkeleton();

    if (clipsData.length === 0) {
        return {
            clips: [],
            currentSkeleton,
            meta: {
                skin: data.skin,
                polygons: data.polygons,
                headRadius: data.headRadius,
                strokeWidth: data.strokeWidth
            }
        };
    }

    // Auto-Normalization Logic
    if (!isSa3 && clipsData.length > 0) {
        // Find Min/Max Y from the first frame of the first clip to determine height
        let minY = Infinity;
        let maxY = -Infinity;

        // Helper to parse legacy position
        const getLegacyPos = (nodeData: any) => {
            if (Array.isArray(nodeData.pos)) {
                return { y: nodeData.pos[1] * INVERT_Y };
            } else if (nodeData.position) {
                return { y: (nodeData.position.y || 0) * INVERT_Y };
            }
            return { y: 0 };
        };

        // Traverse the first frame's root
        const firstClip = clipsData[0];
        const firstKeyframe = (firstClip.keyframes || [])[0];
        if (firstKeyframe) {
            const skelData = firstKeyframe.pose || firstKeyframe.skeleton;
            const rootData = skelData.root || skelData;

            // recursive traversal to find min/max Y
            const traverse = (nodeData: any) => {
                const { y } = getLegacyPos(nodeData);
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                if (nodeData.children) {
                    nodeData.children.forEach((child: any) => traverse(child));
                }
            };
            traverse(rootData);

            const currentHeight = maxY - minY;
            // Avoid division by zero if height is weirdly 0
            if (currentHeight > 0.01) {
                 const TARGET_HEIGHT = 2.0;
                 SCALE = TARGET_HEIGHT / currentHeight;
                 // Lowest point is (minY * SCALE). We want it at 0.
                 // So we add offset: minY * SCALE + offset = 0 => offset = -minY * SCALE
                 verticalOffset = -(minY * SCALE);
            } else {
                 SCALE = 0.25; // Fallback
                 verticalOffset = 0;
            }
        } else {
            SCALE = 0.25; // Fallback
        }
    }


    const reconstructNode = (nodeData: any): StickmanNode => {
        const pos = new Vector3();
        if (Array.isArray(nodeData.pos)) {
            pos.set(
                nodeData.pos[0] * SCALE,
                (nodeData.pos[1] * INVERT_Y * SCALE) + verticalOffset,
                nodeData.pos[2] * SCALE
            );
        } else if (nodeData.position) {
            pos.set(
                (nodeData.position.x || 0) * SCALE,
                ((nodeData.position.y || 0) * INVERT_Y * SCALE) + verticalOffset,
                (nodeData.position.z || 0) * SCALE
            );
        }
        const node = new StickmanNode(nodeData.id || nodeData.name, pos, nodeData.id);
        if (nodeData.children) {
            nodeData.children.forEach((childData: any) => node.addChild(reconstructNode(childData)));
        }
        return node;
    };

    const reconstructedClips: StickmanClip[] = clipsData.map((clipData: any) => {
        const keyframes = (clipData.keyframes || []).map((kf: any) => {
            const skelData = kf.pose || kf.skeleton;
            // Scale radius and stroke width too
            const skeleton = new StickmanSkeleton(
                undefined,
                (skelData.headRadius || data.headRadius || 0.1) * SCALE,
                (skelData.strokeWidth || data.strokeWidth || 0.02) * SCALE
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

    const firstClip = reconstructedClips[0];
    if (firstClip && firstClip.keyframes.length > 0) {
        currentSkeleton = firstClip.keyframes[0].skeleton.clone();
    }

    return {
        clips: reconstructedClips,
        currentSkeleton,
        meta: {
            skin: data.skin || null,
            polygons: data.polygons || null,
            headRadius: currentSkeleton.headRadius,
            strokeWidth: currentSkeleton.strokeWidth
        }
    };

  } catch (e) {
    console.error("Failed to parse project", e);
    throw new Error("Failed to parse stickman project JSON");
  }
}
