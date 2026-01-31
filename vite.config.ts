import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({ include: ['src'] }),
  ],
  build: {
    lib: {
      entry: {
        environs: resolve(__dirname, 'src/index.ts'),
        'jsx-runtime': resolve(__dirname, 'src/rendering/jsx-runtime.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        preserveModules: false,
      },
    },
  },
});
