'use client';

import { useEffect } from 'react';

/**
 * Hook to prevent accidental tab closing or page refresh
 * when an audio operation is processing or unsaved tracks exist.
 */
export function useBeforeUnload(shouldWarn: boolean, message = 'Audio editing is in progress. Are you sure you want to leave?') {
  useEffect(() => {
    if (!shouldWarn) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldWarn, message]);
}
