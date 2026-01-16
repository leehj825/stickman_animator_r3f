import { Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';

export class StickmanNode {
  id: string;
  name: string;
  position: Vector3;
  children: StickmanNode[];

  constructor(name: string, position: Vector3, id?: string) {
    this.id = id || uuidv4();
    this.name = name;
    this.position = position;
    this.children = [];
  }

  addChild(node: StickmanNode) {
    this.children.push(node);
  }

  // Clone this node and its children recursively
  clone(): StickmanNode {
    const newNode = new StickmanNode(this.name, this.position.clone(), this.id);
    newNode.children = this.children.map((child) => child.clone());
    return newNode;
  }

  // Find a node by ID in this subtree
  findNode(id: string): StickmanNode | null {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findNode(id);
      if (found) return found;
    }
    return null;
  }
}
