import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base: Repo-Name, damit Assets unter https://<user>.github.io/anagram/ aufgelöst werden.
// Für eine eigene Domain (Hostinger) auf '/' setzen.
export default defineConfig({
  base: process.env.DEPLOY_BASE ?? '/anagram/',
  plugins: [preact()],
  build: { target: 'es2022' },
});
