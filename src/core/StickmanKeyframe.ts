import { StickmanSkeleton } from './StickmanSkeleton';

export interface StickmanKeyframe {
  id: string;
  skeleton: StickmanSkeleton; // The pose at this keyframe
  timestamp: number; // Time in seconds or frame index
}

export interface StickmanClip {
  id: string;
  name: string;
  keyframes: StickmanKeyframe[];
  duration: number; // Total duration in seconds
}
