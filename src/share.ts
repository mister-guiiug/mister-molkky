export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

export async function shareOrCopy(options: ShareOptions): Promise<
  'shared' | 'copied' | 'failed'
> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as Navigator & { share: (data: ShareOptions) => Promise<void> }).share(
        options
      );
      return 'shared';
    } catch {
      /* fall through to clipboard */
    }
  }
  const text = [options.title, options.text, options.url]
    .filter(Boolean)
    .join('\n');
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function encodeReplayParam(payload: unknown): string {
  const json = JSON.stringify(payload);
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(json)));
  }
  return Buffer.from(json, 'utf-8').toString('base64');
}

export function decodeReplayParam<T>(b64: string): T | undefined {
  try {
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, 'base64').toString('utf-8');
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}
