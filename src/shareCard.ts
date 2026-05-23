/**
 * Render a finished-match summary card to a PNG blob and offer to
 * share/download it. Pure browser — uses an off-screen <canvas> so we
 * don't need an extra render lib, and works offline (PWA-friendly).
 *
 * The card layout is intentionally simple: trophy + winner name on
 * top, podium-style ranking below. Keeps the file under ~80 KB even
 * at 2x DPR.
 */

import type { Locale } from './schemas';

interface RankingRow {
  rank: number;
  name: string;
  color: string;
  finalScore: number;
  eliminated: boolean;
}

interface BuildCardOptions {
  winnerName: string;
  ranking: RankingRow[];
  locale: Locale;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

export async function buildShareCard(
  opts: BuildCardOptions
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * dpr;
  canvas.height = CARD_HEIGHT * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  // Background: matches the in-app dark surface so screenshots feel
  // continuous with the app even when posted on social.
  ctx.fillStyle = '#1f241d';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Accent radial — wood-tone glow upper-left.
  const gradient = ctx.createRadialGradient(220, 180, 50, 220, 180, 700);
  gradient.addColorStop(0, 'rgba(225, 165, 102, 0.35)');
  gradient.addColorStop(1, 'rgba(225, 165, 102, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Header — brand mark + title.
  ctx.fillStyle = '#ecede5';
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.fillText('Mister Mölkky', 80, 140);
  ctx.font = '32px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#989b90';
  ctx.fillText(
    opts.locale === 'fr' ? 'Résultat de la partie' : 'Match result',
    80,
    190
  );

  // Trophy + winner.
  ctx.font = '120px system-ui';
  ctx.fillStyle = '#e1a566';
  ctx.fillText('🏆', 80, 360);
  ctx.font = 'bold 88px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ecede5';
  ctx.fillText(opts.winnerName, 230, 350);
  ctx.font = '36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#989b90';
  ctx.fillText(opts.locale === 'fr' ? 'gagne la partie' : 'wins', 230, 400);

  // Ranking rows.
  const rowY0 = 500;
  const rowH = 90;
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  for (const [i, row] of opts.ranking.entries()) {
    const y = rowY0 + i * rowH;
    // Player color dot.
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(110, y - 20, 24, 0, Math.PI * 2);
    ctx.fill();
    // Rank
    ctx.fillStyle = '#989b90';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.fillText(`#${row.rank}`, 150, y);
    // Name
    ctx.fillStyle = row.rank === 1 ? '#e1a566' : '#ecede5';
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    const prefix = row.eliminated ? '✗ ' : '';
    ctx.fillText(prefix + row.name, 230, y);
    // Final score
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ecede5';
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(row.finalScore), CARD_WIDTH - 80, y);
    ctx.textAlign = 'left';
  }

  // Footer
  ctx.fillStyle = '#989b90';
  ctx.font = '26px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    opts.locale === 'fr'
      ? 'Application offline — mister-guiiug.github.io/mister-molkky'
      : 'Offline app — mister-guiiug.github.io/mister-molkky',
    80,
    CARD_HEIGHT - 60
  );

  return await new Promise<Blob | null>(resolve => {
    canvas.toBlob(b => resolve(b), 'image/png');
  });
}

/**
 * Try the Web Share API with the file; fall back to opening a download
 * link in a new tab. Returns true if SOMETHING happened (share or
 * download trigger), false on hard failure.
 */
export async function shareCard(
  blob: Blob,
  fileName: string,
  text: string
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const file = new File([blob], fileName, { type: 'image/png' });
  // navigator.canShare is feature-detect; not all browsers expose it.
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], text });
      return true;
    } catch {
      /* user dismissed or share failed — fall through to download */
    }
  }
  // Fallback: trigger a download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
