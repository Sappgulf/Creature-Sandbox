import { initializeApp } from './app-bootstrap.js?v=20260528-vitals1';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
