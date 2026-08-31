import {
  Skeleton as SocleSkeleton,
  SkeletonGroup,
} from '@mister-guiiug/dev-wpa-config/react/skeleton';
import { useI18n } from '../../i18n';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

/**
 * Adaptateur vers le Skeleton du socle (`react/skeleton`) : l'apparence
 * (fond `--dwc-surface-2` → `--surface-highlight`, pulsation, contraste
 * forcé, impression) vient de components.css, plus de la copie locale.
 *
 * Ne subsiste ici que la traduction de l'API historique `rounded` →
 * `radius`, parce que des appelants existants (LiveShareSheet) l'utilisent.
 * Pour du code neuf, importer directement le composant du socle.
 */
export function Skeleton({
  className,
  width = '100%',
  height = '1rem',
  rounded = 'md',
}: SkeletonProps) {
  return (
    <SocleSkeleton
      className={className}
      width={width}
      height={height}
      radius={rounded}
    />
  );
}

/**
 * Page-level fallback shown by <Suspense> while a route chunk loads.
 * Mimics the rough silhouette of every view: small header strip on
 * top + a few content blocks, so the layout doesn't pop when the real
 * view paints. Le conteneur annoncé (`role="status"` + aria-busy +
 * libellé lu) est le SkeletonGroup du socle.
 */
export function ViewSkeleton() {
  const { t } = useI18n();
  return (
    <SkeletonGroup
      label={t('common.loading')}
      className="mx-auto w-full max-w-2xl p-4 sm:p-6"
    >
      <div className="mb-3 flex items-center gap-3 pt-6">
        <Skeleton width={56} height={56} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={14} />
        </div>
      </div>
      <Skeleton height={56} rounded="lg" />
      <Skeleton height={56} rounded="lg" />
      <Skeleton height={100} rounded="lg" />
    </SkeletonGroup>
  );
}
