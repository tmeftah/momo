import { createApp } from 'vue';
import '@fontsource-variable/inter';
import App from './App.vue';
import { router } from './router.js';
import { initTheme } from './ui.js';
import { initPwa } from './pwa.js';
import './styles.css';

initTheme();
initPwa();
createApp(App).use(router).mount('#app');
