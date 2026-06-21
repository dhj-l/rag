import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles/main.css';

/**
 * 前端应用入口（ARCHITECTURE.md §2.1 frontend/src/main.ts）
 *
 * T02：接入 router + pinia。
 */
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
