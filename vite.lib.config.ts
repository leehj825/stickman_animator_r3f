import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src/runtime'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/runtime/index.ts'),
      name: 'StickmanAnimatorRuntime',
      fileName: (format) => `stickman-runtime.${format}.js`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          three: 'THREE',
          '@react-three/fiber': 'ReactThreeFiber',
          '@react-three/drei': 'ReactThreeDrei',
        },
      },
    },
    outDir: 'dist-lib',
    emptyOutDir: true,
  },
});
