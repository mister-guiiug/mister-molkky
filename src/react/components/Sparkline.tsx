import { Sparkline as SocleSparkline } from '@mister-guiiug/dev-wpa-config/react/sparkline';

interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
  max?: number;
  /** Libellé de l'alternative textuelle (calculée par `describeSeries`). */
  label?: string;
  /** Mise en forme des valeurs dans l'alternative textuelle. */
  format?: (value: number) => string;
}

/**
 * Adaptateur vers la sparkline du socle (`react/sparkline`) : la géométrie
 * (projection, série constante, arrondis) et l'ALTERNATIVE TEXTUELLE
 * (`describeSeries`, lue par les lecteurs d'écran là où l'ancien SVG était
 * muet) viennent du paquet ; l'habillage de `[data-dwc='sparkline']` vient
 * de components.css.
 *
 * Restent ici les trois choix propres à l'app :
 *  - l'échelle part de zéro (`min=0`) et plafonne au score cible (`max`),
 *    comme l'ancienne copie — sans quoi l'axe suivrait les données ;
 *  - la couleur est celle du JOUEUR : posée sur le conteneur, héritée via
 *    la règle `[data-dwc='sparkline'] { color: inherit }` de styles.css ;
 *  - moins de deux points : simple ligne de base en pointillés. Le socle
 *    marquerait le point isolé, ce qui remettait un point orphelin sous
 *    les cartes de score en début de partie.
 */
export function Sparkline({
  values,
  width = 80,
  height = 22,
  color = 'var(--primary)',
  max,
  label,
  format,
}: SparklineProps) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden className="block">
        <line
          x1={2}
          y1={height - 2}
          x2={width - 2}
          y2={height - 2}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  return (
    <span className="block" style={{ color }}>
      <SocleSparkline
        values={values}
        width={width}
        height={height}
        padding={2}
        min={0}
        max={max ?? Math.max(...values, 1)}
        label={label}
        format={format}
      />
    </span>
  );
}
