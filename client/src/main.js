import { createApp } from 'vue';
import '@fontsource-variable/inter';
import App from './App.vue';
import { router } from './router.js';
import { initTheme } from './ui.js';
import './styles.css';

initTheme();
createApp(App).use(router).mount('#app');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
