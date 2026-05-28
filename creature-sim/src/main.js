import { initializeApp } from './app-bootstrap.js?v=20260528-tranche8';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
