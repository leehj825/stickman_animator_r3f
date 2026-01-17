import { StickmanSkeleton } from './src/core/StickmanSkeleton';
import { Vector3 } from 'three';

const skeleton = new StickmanSkeleton();
console.log('Head Radius:', skeleton.headRadius);
console.log('Stroke Width:', skeleton.strokeWidth);

const nodes = skeleton.getAllNodes();
const foot = nodes.find(n => n.name === 'leftFoot');
const hip = nodes.find(n => n.name === 'hip');
const head = nodes.find(n => n.name === 'head');

console.log('Hip Position:', hip?.position);
console.log('Head Position:', head?.position);
console.log('Foot Position:', foot?.position);

if (foot && Math.abs(foot.position.y - skeleton.strokeWidth) < 0.001) {
    console.log('Verification Passed: Foot y-position matches radius, meaning it sits on grid.');
} else {
    console.log('Verification Failed: Foot y-position ' + foot?.position.y + ' does not match radius ' + skeleton.strokeWidth);
}

if (Math.abs(skeleton.headRadius - 0.1) < 0.001) {
    console.log('Verification Passed: Head radius reduced.');
} else {
    console.log('Verification Failed: Head radius ' + skeleton.headRadius);
}
