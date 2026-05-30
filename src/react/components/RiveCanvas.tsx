import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

interface RiveCanvasProps {
  src: string;
  stateMachine?: string;
  artboard?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Thin wrapper around the Rive runtime, isolated in its own module so
 * `RiveScene` can pull it in via React.lazy — the `@rive-app/react-canvas`
 * bundle (WASM + runtime, ~200 KB) then only loads for the handful of
 * screens that actually render an animation (welcome tutorial, install
 * prompt), instead of weighing down the initial app chunk.
 *
 * Default export so it plugs straight into `lazy(() => import(...))`.
 */
export default function RiveCanvas({
  src,
  stateMachine,
  artboard,
  className,
  ariaLabel,
}: RiveCanvasProps) {
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
