#!/usr/bin/env node
// ตรวจว่า apps/*/app/ มีแต่ route/metadata file เท่านั้น (Next App Router)
// — กัน component/hook/css/asset/folder หลุดเข้า app/ "ทุกชนิดไฟล์" (eslint เห็นแค่ .ts/.tsx จึงจับ .css ไม่ได้)
// styles → src/presentation/styles/ · component/hook/logic → src/presentation/
// รันใน `pnpm gate` (ส่วนหนึ่งของ check ก่อนบอกเสร็จ)
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const ROUTE =
  /^(page|layout|template|loading|error|not-found|global-error|default|route)\.(tsx?|jsx?)$/;
const META =
  /^(favicon\.ico|sitemap\.(tsx?|jsx?|xml)|robots\.(tsx?|jsx?|txt)|manifest\.(tsx?|jsx?|json|webmanifest)|(icon|apple-icon|opengraph-image|twitter-image)\d*\.(tsx?|jsx?|ico|png|jpe?g|svg|gif))$/;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
}

function appDirs() {
  const dirs = [];
  for (const app of readdirSync('apps')) {
    const appDir = join('apps', app, 'app');
    try {
      if (statSync(appDir).isDirectory()) dirs.push(appDir);
    } catch {
      // ไม่มี app/ (เช่น Fastify/Vite) — ข้าม
    }
  }
  return dirs;
}

const bad = [];
for (const dir of appDirs()) {
  const files = [];
  walk(dir, files);
  for (const f of files) {
    const base = basename(f);
    if (!ROUTE.test(base) && !META.test(base)) bad.push(f);
  }
}

if (bad.length) {
  console.error('❌ app/ = routing/metadata files เท่านั้น — ไฟล์เหล่านี้ไม่ใช่ route:');
  for (const f of bad) console.error('   ' + f);
  console.error(
    '   → styles ไป src/presentation/styles/ · component/hook/logic ไป src/presentation/',
  );
  process.exit(1);
}
console.log('✓ app/ routing-only');
