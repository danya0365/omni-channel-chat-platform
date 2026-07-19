import { defineConfig } from 'vite';

// build เป็น IIFE lib → ฝังผ่าน <script src="widget.js"> ได้ · exposes global `OmniWidget`
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'OmniWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
  },
});
