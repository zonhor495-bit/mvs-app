import type { ProfilerOnRenderCallback } from 'react';

export const profCallback: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  try {
    if (typeof window === 'undefined') return;
    console.log('PROFILER CALLBACK', { id, phase, actualDuration, baseDuration, startTime, commitTime });
    (window as any).__REACT_PROFILER_LOGS__ = (window as any).__REACT_PROFILER_LOGS__ || [];
    (window as any).__REACT_PROFILER_LOGS__.push({
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error('PROFILER CALLBACK ERROR', e);
  }
};

export default profCallback;
