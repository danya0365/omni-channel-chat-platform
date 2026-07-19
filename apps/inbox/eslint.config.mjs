import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// รายชื่อ route file ที่ Next อนุญาตให้อยู่ใน app/ (ดู node_modules/next/dist/docs/.../02-project-structure.md)
const ROUTE_FILES =
  'app/**/{page,layout,template,loading,error,not-found,global-error,default,route,sitemap,robots,manifest,opengraph-image,twitter-image,icon,apple-icon}.{ts,tsx}';

// สี Tailwind palette ที่ห้ามใช้ดิบ (ใช้ semantic token แทน) — ดู .claude/rules/frontend-next.md §Tailwind
const RAW_COLORS =
  'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    // สถาปัตยกรรม frontend (ดู .claude/rules/frontend-next.md) — กันไฟล์/ฟังก์ชันบวมเป็น God component
    // + คง type-import convention. ครอบทั้ง app/ (route) และ src/ (code) · ยกเว้น test
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 1 ไฟล์ = 1 หน่วยความรับผิดชอบ · เกิน = สัญญาณให้แตก component/hook (God component เปลือง re-render)
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 12],
      'max-depth': ['error', 4],
    },
  },
  {
    // token-pure className (semantic theme) — ห้าม hex/สีดิบ/[var()]/condition ดิบ + inline style
    // ดู .claude/rules/frontend-next.md · skill nextjs-semantic-theme · dynamic runtime = +eslint-disable ตรงจุด
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/\\[[^\\]]*#[0-9a-fA-F]{3,8}/]',
          message:
            'ห้าม hex ใน className — ย้ายค่าเข้า app/themes/*.css แล้วใช้ token utility (bg-brand-600 ฯลฯ)',
        },
        {
          selector:
            'Literal[value=/\\b(bg|text|border|ring|from|via|to|fill|stroke|divide|outline)-(' +
            RAW_COLORS +
            ')(-[0-9]{2,3})?\\b/]',
          message:
            'ห้ามสี Tailwind ดิบ — ใช้ semantic token (bg-card, text-muted, border-border, bg-brand-600, text-on-brand, bg-warning-surface)',
        },
        {
          selector: 'Literal[value=/\\[[^\\]]*var\\(--/]',
          message:
            'ห้าม [var(--token)] ใน className — register token ใน app/theme.css แล้วใช้ utility · dynamic runtime เท่านั้นที่ยกเว้น (+eslint-disable)',
        },
        {
          selector:
            "JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral[expressions.length>0]",
          message:
            'ห้าม interpolation/condition ดิบใน className template literal — ครอบ cn() (cn("base", cond ? "a" : "b"))',
        },
        {
          selector:
            "JSXAttribute[name.name='className'] > JSXExpressionContainer > ConditionalExpression",
          message: 'ห้าม ternary ดิบใน className — ครอบ cn() (cn(cond ? "a" : "b"))',
        },
        {
          selector:
            "JSXAttribute[name.name='className'] > JSXExpressionContainer > LogicalExpression",
          message: 'ห้าม &&/|| ดิบใน className — ครอบ cn() (cn(cond && "x"))',
        },
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            'ใช้ className + token — inline style เฉพาะ CSS var dynamic runtime (+eslint-disable ตรงจุด)',
        },
      ],
    },
  },
  {
    // app/ = routing เท่านั้น — component/hook/logic ห้ามอยู่ที่นี่ (ให้ดูออกว่า folder ไหนคือ route)
    // วางไว้ท้ายสุด → ไฟล์ non-route ใน app/ ได้ error นี้ก่อน (ให้ย้ายไป src/ ก่อนค่อยเช็คอื่น)
    files: ['app/**/*.{ts,tsx}'],
    ignores: [ROUTE_FILES],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'app/ = routing files เท่านั้น (page/layout/…) — ย้าย component/hook/logic ไป src/presentation/ (ดู .claude/rules/frontend-next.md)',
        },
      ],
    },
  },
]);

export default eslintConfig;
