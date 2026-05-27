import { initializeApp } from './app-bootstrap.js?v=20260527-perf1';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
