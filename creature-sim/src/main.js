import { initializeApp } from './app-bootstrap.js?v=20260524-opening2';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
