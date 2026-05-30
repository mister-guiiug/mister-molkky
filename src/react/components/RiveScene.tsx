import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

// Lazy boundary: the Rive runtime lives in RiveCanvas and only loads once
// a valid .riv file has been probed (see below), keeping the WASM bundle
// out of the initial app chunk.
const RiveCanvas = lazy(() => import('./RiveCanvas'));

interface RiveSceneProps {
  src: string;
  stateMachine?: string;
  artboard?: string;
  className?: string;
  fallback?: ReactNode;
  ariaLabel?: string;
}

interface ProbeState {
  src: string;
  status: 'pending' | 'ok' | 'missing';
}

const RIVE_MAGIC = 'RIVE';

async function probeRiveFile(src: string): Promise<boolean> {
  try {
    const response = await fetch(src, { cache: 'no-store' });
    if (!response.ok) return false;
    const buffer = await response.clone().arrayBuffer();
    if (buffer.byteLength < 4) return false;
    const head = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
    return head === RIVE_MAGIC;
  } catch {
    return false;
  }
}

export function RiveScene({
  src,
  stateMachine,
  artboard,
  className,
  fallback,
  ariaLabel,
}: RiveSceneProps) {
  const [probe, setProbe] = useState<ProbeState>({ src, status: 'pending' });

  useEffect(() => {
    let cancelled = false;
    probeRiveFile(src).then(ok => {
      if (!cancelled) setProbe({ src, status: ok ? 'ok' : 'missing' });
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (probe.src !== src || probe.status !== 'ok') {
    return <>{fallback ?? null}</>;
  }

  // Show the same fallback while the lazy Rive chunk downloads so there's
  // no blank flash between "file probed OK" and "runtime ready".
  return (
    <Suspense fallback={<>{fallback ?? null}</>}>
      <RiveCanvas
        src={src}
        stateMachine={stateMachine}
        artboard={artboard}
        className={className}
        ariaLabel={ariaLabel}
      />
    </Suspense>
  );
}
