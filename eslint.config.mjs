import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/next-env.d.ts',
      '**/*.config.{js,cjs,mjs}',
      '.dependency-cruiser.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // บังคับ boundary ระดับ import: core ห้ามพึ่ง framework — เสริมด้วย dependency-cruiser (gate)
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // 🚫 กัน God function/file ทั้ง repo (backend apps/api · packages · widget)
    //   ปรัชญาเดียวกับ inbox: 1 หน่วย = 1 หน้าที่ — component = render อย่างเดียว ·
    //   orchestration/state ไป hook · pure logic ไป lib · (backend) handler บาง → logic ไป domain/service
    //   inbox มี config ของตัวเอง (เข้มกว่า: max-lines 200 + token-pure) → ยกเว้นที่นี่ ไม่เขียนซ้ำ
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'apps/inbox/**'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 12],
      'max-depth': ['error', 4],
    },
  },
  {
    // gate scripts (Node ESM) — มี node globals
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },
);
