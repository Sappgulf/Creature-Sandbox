import { initializeApp } from './app-bootstrap.js?v=20260528-tranche8';

(async function bootstrap() {
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }
  await initializeApp();
})();
