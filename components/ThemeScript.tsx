import { STORAGE_KEY } from '@/lib/theme';

// Runs synchronously before the browser paints <body>, so the correct
// theme is on <html> from the first frame — no flash. Kept tiny and
// dependency-free on purpose.
const SNIPPET = `(function(){try{
var k=${JSON.stringify(STORAGE_KEY)};
var s=localStorage.getItem(k);
var m=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
document.documentElement.setAttribute('data-theme',m);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SNIPPET }} />;
}
