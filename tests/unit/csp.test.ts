import { describe, it, expect } from 'vitest';
import { addCsp, inlineHashes } from '../../scripts/csp-lib.mjs';

describe('política de seguridad de las páginas', () => {
  const html =
    '<!DOCTYPE html><html><head><script>self.__next_f=1</script><script src="/_next/a.js"></script></head><body></body></html>';
  it('permite solo los scripts incrustados por su huella y nunca unsafe-inline para scripts', () => {
    const out: string = addCsp(html);
    const content = out.match(/content="([^"]+)"/)![1];
    const script = content.split('; ').find((d: string) => d.startsWith('script-src'))!;
    expect(script.includes("'unsafe-inline'")).toBe(false);
    expect(script.includes(inlineHashes(html)[0])).toBe(true);
    expect(inlineHashes(html)).toHaveLength(1);
    expect(content.includes('connect-src')).toBe(true);
  });
  it('se ubica antes que cualquier script y no se duplica', () => {
    const out: string = addCsp(html);
    expect(out.indexOf('Content-Security-Policy') < out.indexOf('<script')).toBe(true);
    expect(addCsp(out)).toBe(out);
  });
});
