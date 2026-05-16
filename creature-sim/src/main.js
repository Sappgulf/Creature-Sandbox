import { initializeApp } from './app-bootstrap.js?v=20260516-audit1';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
