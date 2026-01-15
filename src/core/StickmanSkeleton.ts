import { Vector3 } from 'three';
import { StickmanNode } from './StickmanNode';

export class StickmanSkeleton {
  root: StickmanNode;

  constructor(root?: StickmanNode) {
    if (root) {
      this.root = root;
    } else {
      this.root = this.createDefaultSkeleton();
    }
  }

  // Create a standard stickman skeleton
  createDefaultSkeleton(): StickmanNode {
    // Hip is the root
    const hip = new StickmanNode('hip', new Vector3(0, 1, 0));

    // Torso -> Neck -> Head
    const torso = new StickmanNode('torso', new Vector3(0, 1.5, 0));
    const neck = new StickmanNode('neck', new Vector3(0, 1.8, 0));
    const head = new StickmanNode('head', new Vector3(0, 2.1, 0));

    hip.addChild(torso);
    torso.addChild(neck);
    neck.addChild(head);

    // Arms
    const leftShoulder = new StickmanNode('leftShoulder', new Vector3(-0.3, 1.7, 0));
    const leftElbow = new StickmanNode('leftElbow', new Vector3(-0.6, 1.4, 0));
    const leftHand = new StickmanNode('leftHand', new Vector3(-0.8, 1.1, 0));

    const rightShoulder = new StickmanNode('rightShoulder', new Vector3(0.3, 1.7, 0));
    const rightElbow = new StickmanNode('rightElbow', new Vector3(0.6, 1.4, 0));
    const rightHand = new StickmanNode('rightHand', new Vector3(0.8, 1.1, 0));

    neck.addChild(leftShoulder);
    leftShoulder.addChild(leftElbow);
    leftElbow.addChild(leftHand);

    neck.addChild(rightShoulder);
    rightShoulder.addChild(rightElbow);
    rightElbow.addChild(rightHand);

    // Legs
    const leftHipJoint = new StickmanNode('leftHipJoint', new Vector3(-0.2, 0.9, 0));
    const leftKnee = new StickmanNode('leftKnee', new Vector3(-0.25, 0.5, 0));
    const leftFoot = new StickmanNode('leftFoot', new Vector3(-0.3, 0.1, 0));

    const rightHipJoint = new StickmanNode('rightHipJoint', new Vector3(0.2, 0.9, 0));
    const rightKnee = new StickmanNode('rightKnee', new Vector3(0.25, 0.5, 0));
    const rightFoot = new StickmanNode('rightFoot', new Vector3(0.3, 0.1, 0));

    hip.addChild(leftHipJoint);
    leftHipJoint.addChild(leftKnee);
    leftKnee.addChild(leftFoot);

    hip.addChild(rightHipJoint);
    rightHipJoint.addChild(rightKnee);
    rightKnee.addChild(rightFoot);

    return hip;
  }

  clone(): StickmanSkeleton {
    return new StickmanSkeleton(this.root.clone());
  }

  // Linear interpolate between this skeleton and another
  lerp(target: StickmanSkeleton, alpha: number): StickmanSkeleton {
    const newSkeleton = this.clone();
    this._lerpNode(newSkeleton.root, target.root, alpha);
    return newSkeleton;
  }

  private _lerpNode(current: StickmanNode, target: StickmanNode, alpha: number) {
    // If IDs match (should be the case for same skeleton structure), lerp position
    // Assuming structure is identical for now
    if (current.id === target.id) {
       current.position.lerp(target.position, alpha);
    }

    // Because we cloned the skeleton, the children order should be preserved
    // But let's be safe and try to match children by ID if possible, or index
    for (let i = 0; i < current.children.length; i++) {
        const child = current.children[i];
        // Find corresponding child in target
        // Since we assume identical structure (cloned from same base), index usually works
        // But let's use ID if we can ensure target has same IDs.
        // Wait, if we are lerping between keyframes, keyframes store a snapshot of the skeleton.
        // So the IDs should be consistent across keyframes if they are clones.

        // However, target.children[i] might not be the same node if structure changed?
        // For this task, we assume rigid skeleton structure across animation.
        if (i < target.children.length) {
            this._lerpNode(child, target.children[i], alpha);
        }
    }
  }

  // Helper to get all nodes as a flat list
  getAllNodes(): StickmanNode[] {
      const nodes: StickmanNode[] = [];
      const traverse = (node: StickmanNode) => {
          nodes.push(node);
          node.children.forEach(traverse);
      };
      traverse(this.root);
      return nodes;
  }

  // Update a specific node position
  updateNodePosition(id: string, position: Vector3) {
      const node = this.root.findNode(id);
      if (node) {
          node.position.copy(position);
      }
  }
}
