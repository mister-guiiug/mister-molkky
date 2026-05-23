import { useEffect, useState, type ReactNode } from 'react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

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

  return (
    <RiveCanvas
      src={src}
      stateMachine={stateMachine}
      artboard={artboard}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}

function RiveCanvas({
  src,
  stateMachine,
  artboard,
  className,
  ariaLabel,
}: Omit<RiveSceneProps, 'fallback'>) {
  const { RiveComponent } = useRive({
    src,
    stateMachines: stateMachine,
    artboard,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  });

  return (
    <RiveComponent className={className} role="img" aria-label={ariaLabel} />
  );
}
