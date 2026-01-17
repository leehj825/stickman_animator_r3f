import { Vector3 } from 'three';
import { StickmanNode } from './StickmanNode';

export class StickmanSkeleton {
  root: StickmanNode;
  headRadius: number;
  strokeWidth: number;

  // INCREASED DEFAULT SIZES
  constructor(root?: StickmanNode, headRadius: number = 0.35, strokeWidth: number = 0.1) {
    if (root) {
      this.root = root;
    } else {
      this.root = this.createDefaultSkeleton();
    }
    this.headRadius = headRadius;
    this.strokeWidth = strokeWidth;
  }

  get nodes(): StickmanNode[] {
    const nodes: StickmanNode[] = [];
    const traverse = (node: StickmanNode) => {
        nodes.push(node);
        node.children.forEach(traverse);
    };
    traverse(this.root);
    return nodes;
  }

  createDefaultSkeleton(): StickmanNode {
    // Increased Y scale slightly to match new thickness
    const hip = new StickmanNode('hip', new Vector3(0, 1.0, 0));

    const torso = new StickmanNode('torso', new Vector3(0, 1.5, 0));
    const neck = new StickmanNode('neck', new Vector3(0, 1.8, 0));
    const head = new StickmanNode('head', new Vector3(0, 2.1, 0)); // Head higher

    hip.addChild(torso);
    torso.addChild(neck);
    neck.addChild(head);

    const leftElbow = new StickmanNode('leftElbow', new Vector3(-0.4, 1.5, 0));
    const leftHand = new StickmanNode('leftHand', new Vector3(-0.6, 1.2, 0));

    const rightElbow = new StickmanNode('rightElbow', new Vector3(0.4, 1.5, 0));
    const rightHand = new StickmanNode('rightHand', new Vector3(0.6, 1.2, 0));

    neck.addChild(leftElbow);
    leftElbow.addChild(leftHand);

    neck.addChild(rightElbow);
    rightElbow.addChild(rightHand);

    // Legs
    const leftKnee = new StickmanNode('leftKnee', new Vector3(-0.3, 0.5, 0));
    const leftFoot = new StickmanNode('leftFoot', new Vector3(-0.3, 0.0, 0)); // On floor

    const rightKnee = new StickmanNode('rightKnee', new Vector3(0.3, 0.5, 0));
    const rightFoot = new StickmanNode('rightFoot', new Vector3(0.3, 0.0, 0)); // On floor

    hip.addChild(leftKnee);
    leftKnee.addChild(leftFoot);

    hip.addChild(rightKnee);
    rightKnee.addChild(rightFoot);

    return hip;
  }

  clone(): StickmanSkeleton {
    return new StickmanSkeleton(this.root.clone(), this.headRadius, this.strokeWidth);
  }

  lerp(target: StickmanSkeleton, alpha: number): StickmanSkeleton {
    const newSkeleton = this.clone();
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

  getAllNodes(): StickmanNode[] {
      return this.nodes;
  }

  updateNodePosition(id: string, position: Vector3) {
      const node = this.root.findNode(id);
      if (node) {
          node.position.copy(position);
      }
  }
}
