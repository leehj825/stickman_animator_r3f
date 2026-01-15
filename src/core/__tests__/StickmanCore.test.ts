import { describe, it, expect } from 'vitest';
import { StickmanNode } from '../StickmanNode';
import { StickmanSkeleton } from '../StickmanSkeleton';
import { Vector3 } from 'three';

describe('StickmanNode', () => {
    it('should create a node with correct properties', () => {
        const pos = new Vector3(1, 2, 3);
        const node = new StickmanNode('test', pos);
        expect(node.name).toBe('test');
        expect(node.position.equals(pos)).toBe(true);
        expect(node.children).toEqual([]);
        expect(node.id).toBeDefined();
    });

    it('should clone correctly', () => {
        const root = new StickmanNode('root', new Vector3(0, 0, 0));
        const child = new StickmanNode('child', new Vector3(1, 1, 1));
        root.addChild(child);

        const clone = root.clone();
        expect(clone.name).toBe('root');
        expect(clone.children.length).toBe(1);
        expect(clone.children[0].name).toBe('child');
        expect(clone.children[0].position.equals(child.position)).toBe(true);
        // IDs should be preserved in this implementation for animation matching?
        // Let's check the implementation.
        // The clone implementation: new StickmanNode(this.name, this.position.clone(), this.id);
        // So ID IS preserved.
        expect(clone.id).toBe(root.id);
    });
});

describe('StickmanSkeleton', () => {
    it('should create default skeleton', () => {
        const skeleton = new StickmanSkeleton();
        expect(skeleton.root).toBeDefined();
        expect(skeleton.root.name).toBe('hip');
    });

    it('should find node by id', () => {
        const skeleton = new StickmanSkeleton();
        // hip -> torso -> neck -> head
        // The default skeleton structure:
        // indices might vary, let's just search for known name if we could, but findNode is by ID.
        // Let's search for root id
        expect(skeleton.root.findNode(skeleton.root.id)).toBe(skeleton.root);
    });
});
