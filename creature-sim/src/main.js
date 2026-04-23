import { initializeApp } from './app-bootstrap.js?v=20260423-smoke3';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
