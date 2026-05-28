import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// ispark-ui 스타일
import '@leechanyong/ispark-ui/dist/ispark-ui.css'
import './style.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .mount('#app')
