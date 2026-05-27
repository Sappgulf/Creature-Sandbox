import { initializeApp } from './app-bootstrap.js?v=20260527-tranche4';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
