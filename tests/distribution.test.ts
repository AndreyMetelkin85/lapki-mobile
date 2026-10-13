import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dockerfile = readFileSync(new URL('../docker/Dockerfile.distribution', import.meta.url), 'utf8');
const nginx = readFileSync(new URL('../docker/distribution/nginx.conf', import.meta.url), 'utf8');
const page = readFileSync(new URL('../docker/distribution/index.html', import.meta.url), 'utf8');
const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

test('APK distribution pins a published version and verifies its SHA-256', () => {
  const version = dockerfile.match(/^ARG APK_VERSION=(.+)$/m)?.[1];
  const checksum = dockerfile.match(/^ARG APK_SHA256=([a-f0-9]{64})$/m)?.[1];
  assert.equal(version, config.expo.version);
  assert.ok(checksum);
  assert.match(dockerfile, /releases\/download\/v\$\{APK_VERSION\}/);
  assert.match(dockerfile, /sha256sum -c/);
  assert.match(dockerfile, /USER nginx/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.doesNotMatch(dockerfile, /COPY\s+\.\s+\./);
});

test('APK download page explains the emulator ABI and actual installation', () => {
  assert.match(page, /x86_64/);
  assert.match(page, /href="lapki-android\.apk"/);
  assert.match(page, /href="release\.json"/);
  assert.match(page, /href="lapki-android\.apk\.sha256"/);
  assert.match(page, /10\.0\.2\.2:8080\/api\/v3/);
  assert.match(page, /ARM-сборка/);
  assert.match(nginx, /pid \/tmp\/nginx\.pid/);
  assert.match(nginx, /application\/vnd\.android\.package-archive/);
  assert.match(nginx, /log_format safe '\$request_method \$uri \$status'/);
  assert.doesNotMatch(nginx, /\$request_uri/);
});
