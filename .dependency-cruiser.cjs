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
      to: { path: '^(packages/(db|channel-|bot-)|apps/)' },
    },
    {
      name: 'adapter-only-domain',
      comment:
        'adapter (db, channel-*, bot-*) พึ่งได้แค่ domain + ตัวเอง — ห้ามพึ่ง app หรือ adapter อื่น',
      severity: 'error',
      from: { path: '^packages/(db|channel-[^/]+|bot-[^/]+)/' },
      to: { path: '^(apps/|packages/)', pathNot: '^(packages/domain/|packages/$1/)' },
    },
    {
      name: 'no-import-apps',
      comment: 'packages ห้าม import จาก apps — app เป็นปลายทาง ไม่ใช่ dependency',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    // ── apps/inbox hexagonal (frontend) — ดู .claude/rules/frontend-next.md ──
    // ทิศ: presentation → data → domain · presentation ภายใน: components → hooks → lib · domain = center บริสุทธิ์
    {
      name: 'inbox-src-only-allowed-folders',
      comment: 'apps/inbox/src/ อนุญาตเฉพาะ: domain, data, presentation — ห้าม folder อื่น',
      severity: 'error',
      from: {},
      to: {
        path: '^apps/inbox/src/[^/]+/.+',
        pathNot: '^apps/inbox/src/(domain|data|presentation)/',
      },
    },
    {
      name: 'inbox-domain-pure',
      comment: 'apps/inbox/src/domain/ = contract ล้วน — ห้าม import data/presentation/react/next',
      severity: 'error',
      from: { path: '^apps/inbox/src/domain/' },
      to: { path: '^apps/inbox/src/(data|presentation)/|node_modules/(react|react-dom|next)' },
    },
    {
      name: 'inbox-data-no-presentation',
      comment:
        'apps/inbox/src/data/ (adapter) ห้าม import presentation (ทิศไหลเข้า domain เท่านั้น)',
      severity: 'error',
      from: { path: '^apps/inbox/src/data/' },
      to: { path: '^apps/inbox/src/presentation/' },
    },
    {
      name: 'inbox-components-no-data',
      comment:
        'presentation/components ห้าม import data ตรง — ต้องผ่าน hook (กัน side-effect รั่วเข้า UI)',
      severity: 'error',
      from: { path: '^apps/inbox/src/presentation/components/' },
      to: { path: '^apps/inbox/src/data/' },
    },
    {
      name: 'inbox-lib-no-data',
      comment: 'presentation/lib (pure) ห้าม import data',
      severity: 'error',
      from: { path: '^apps/inbox/src/presentation/lib/' },
      to: { path: '^apps/inbox/src/data/' },
    },
    {
      name: 'inbox-hooks-no-components',
      comment: 'presentation/hooks ห้าม import components (ทิศ: components → hooks)',
      severity: 'error',
      from: { path: '^apps/inbox/src/presentation/hooks/' },
      to: { path: '^apps/inbox/src/presentation/components/' },
    },
    {
      name: 'inbox-lib-no-components-hooks',
      comment: 'presentation/lib (pure) ห้าม import components/hooks',
      severity: 'error',
      from: { path: '^apps/inbox/src/presentation/lib/' },
      to: { path: '^apps/inbox/src/presentation/(components|hooks)/' },
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
    doNotFollow: { path: '(node_modules|\\.next)' },
    // apps/billing = เครื่องมือ marketing แยกเดี่ยว ไม่ใช่ส่วนของ product — ไม่อยู่ใต้ boundary rule
    exclude: { path: '^apps/billing' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
