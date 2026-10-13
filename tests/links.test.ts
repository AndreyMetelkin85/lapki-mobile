import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNativePath } from '../src/links.ts';

test('native intent preserves encoded Cyrillic and normal route parameters', () => {
  const path =
    'lapki://item/10000000-0000-4000-8000-000000000001?kind=pet&name=%D0%9A%D0%BE%D1%82';
  assert.equal(safeNativePath(path), path);
});
test('malformed percent encoding and oversized intent fall back before router decoding', () => {
  for (const path of [
    'lapki://orders?x=%E0%A4',
    'lapki://orders?x=%FF'.repeat(30),
    'lapki://orders?x=%',
    'x'.repeat(4097),
    null,
  ])
    assert.equal(safeNativePath(path), '/');
});
