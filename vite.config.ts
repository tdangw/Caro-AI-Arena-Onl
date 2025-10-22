import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Tên Repository CHÍNH XÁC: Caro-AI-Arena-Onl (AI viết HOA)
  const repoName = 'Caro-AI-Arena-Onl';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    // ĐÃ SỬA: base path phải khớp 100% tên repository (case-sensitive)
    base: `/${repoName}/`,

    plugins: [react()],

    define: {
      // Giữ nguyên phần định nghĩa biến môi trường
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        // Giữ nguyên phần alias
        '@': path.resolve('.'),
      },
    },
  };
});
