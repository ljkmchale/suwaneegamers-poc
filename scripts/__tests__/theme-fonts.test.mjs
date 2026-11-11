import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../../apps/web/app/fonts/', import.meta.url);
test('all theme font URLs resolve to bundled WOFF2 files', () => {
  const css = fs.readFileSync(new URL('fonts.css', root), 'utf8');
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(match => match[1]);
  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.ok(url.startsWith('./'), url);
    assert.equal(fs.readFileSync(new URL(url, root)).subarray(0,4).toString(), 'wOF2', url);
  }
  for (const variable of ['cinzel','lora','im-fell','uncial','spectral','playfair','crimson','medieval']) assert.ok(css.includes(`--font-${variable}:`));
  const layout = fs.readFileSync(new URL('../../apps/web/app/layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('./fonts/fonts.css'));
  assert.ok(!layout.includes('next/font/google'));
});
