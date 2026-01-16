import { Vector3 } from 'three';
import { StickmanNode } from './StickmanNode';

export class StickmanSkeleton {
  root: StickmanNode;
  headRadius: number;
  strokeWidth: number;

  constructor(root?: StickmanNode, headRadius: number = 0.2, strokeWidth: number = 0.1) {
    if (root) {
      this.root = root;
    } else {
      this.root = this.createDefaultSkeleton();
    }
    this.headRadius = headRadius;
    this.strokeWidth = strokeWidth;
  }

  // Getter for all nodes as a flat list
  get nodes(): StickmanNode[] {
    const nodes: StickmanNode[] = [];
    const traverse = (node: StickmanNode) => {
        nodes.push(node);
        node.children.forEach(traverse);
    };
    traverse(this.root);
    return nodes;
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

    // Arms (Connected directly to Neck, per your request)
    // Adjusted positions slightly to look natural without shoulders
    const leftElbow = new StickmanNode('leftElbow', new Vector3(-0.3, 1.4, 0));
    const leftHand = new StickmanNode('leftHand', new Vector3(-0.5, 1.1, 0));

    const rightElbow = new StickmanNode('rightElbow', new Vector3(0.3, 1.4, 0));
    const rightHand = new StickmanNode('rightHand', new Vector3(0.5, 1.1, 0));

    neck.addChild(leftElbow);
    leftElbow.addChild(leftHand);

    neck.addChild(rightElbow);
    rightElbow.addChild(rightHand);

    // Legs (Connected directly to Hip)
    const leftKnee = new StickmanNode('leftKnee', new Vector3(-0.2, 0.5, 0));
    const leftFoot = new StickmanNode('leftFoot', new Vector3(-0.25, 0.1, 0));

    const rightKnee = new StickmanNode('rightKnee', new Vector3(0.2, 0.5, 0));
    const rightFoot = new StickmanNode('rightFoot', new Vector3(0.25, 0.1, 0));

    hip.addChild(leftKnee);
    leftKnee.addChild(leftFoot);

    hip.addChild(rightKnee);
    rightKnee.addChild(rightFoot);

    return hip;
  }

  clone(): StickmanSkeleton {
    return new StickmanSkeleton(this.root.clone(), this.headRadius, this.strokeWidth);
  }

  // Linear interpolate between this skeleton and another
  lerp(target: StickmanSkeleton, alpha: number): StickmanSkeleton {
    const newSkeleton = this.clone();
    // Lerp properties
    newSkeleton.headRadius = this.headRadius + (target.headRadius - this.headRadius) * alpha;
    newSkeleton.strokeWidth = this.strokeWidth + (target.strokeWidth - this.strokeWidth) * alpha;

    this._lerpNode(newSkeleton.root, target.root, alpha);
    return newSkeleton;
  }

  private _lerpNode(current: StickmanNode, target: StickmanNode, alpha: number) {
    if (current.id === target.id) {
       current.position.lerp(target.position, alpha);
    }

    for (let i = 0; i < current.children.length; i++) {
        const child = current.children[i];
        if (i < target.children.length) {
            this._lerpNode(child, target.children[i], alpha);
        }
    }
  }

  // Helper to get all nodes as a flat list
  getAllNodes(): StickmanNode[] {
      return this.nodes;
  }

  // Update a specific node position
  updateNodePosition(id: string, position: Vector3) {
      const node = this.root.findNode(id);
      if (node) {
          node.position.copy(position);
      }
  }
}
