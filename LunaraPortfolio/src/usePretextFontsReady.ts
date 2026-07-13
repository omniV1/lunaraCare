import { useEffect, useState } from 'react';

/** Fonts used by @chenglou/pretext layout — must be loaded before measuring. */
const PRETEXT_FONT_SPECS = [
  '500 16px "Luxurious Roman"',
  '500 18px "Luxurious Roman"',
  '500 20px "Luxurious Roman"',
  '400 16.5px Inter, "Segoe UI", sans-serif',
  'italic 600 21px "Playfair Display", Georgia, serif',
  '700 98px "Playfair Display"',
] as const;

let fontsPromise: Promise<void> | null = null;

function loadPretextFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;

  fontsPromise = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return;

    await Promise.all(
      PRETEXT_FONT_SPECS.map((spec) => document.fonts.load(spec).catch(() => undefined))
    );
    await document.fonts.ready;
  })();

  return fontsPromise;
}

export function usePretextFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadPretextFonts().then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
