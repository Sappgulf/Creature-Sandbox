import { initializeApp } from './app-bootstrap.js?v=20260526-tranche1';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
