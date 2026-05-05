import { initializeApp } from './app-bootstrap.js?v=20260504-menu1';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
