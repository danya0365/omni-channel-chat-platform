/**
 * Boundary rules — บังคับทิศ dependency: apps → adapter → domain (ห้ามย้อน)
 * domain = หัวใจ business ห้ามพึ่งใคร · adapter (db, channel-*) พึ่งได้แค่ domain · apps ห้ามถูก import กลับ
 * รันผ่าน `pnpm check:boundaries` (ส่วนหนึ่งของ `pnpm gate`)
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'packages/domain ห้าม import workspace อื่น (adapter/app) — เป็น core ล้วน',
      severity: 'error',
      from: { path: '^packages/domain' },
      to: { path: '^(packages/(db|channel-)|apps/)' },
    },
    {
      name: 'adapter-only-domain',
      comment:
        'adapter (db, channel-*) พึ่งได้แค่ domain + ตัวเอง — ห้ามพึ่ง app หรือ adapter อื่น',
      severity: 'error',
      from: { path: '^packages/(db|channel-[^/]+)/' },
      to: { path: '^(apps/|packages/)', pathNot: '^(packages/domain/|packages/$1/)' },
    },
    {
      name: 'no-import-apps',
      comment: 'packages ห้าม import จาก apps — app เป็นปลายทาง ไม่ใช่ dependency',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'no-circular',
      comment: 'ห้าม circular dependency',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
