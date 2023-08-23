import {createApp, defineAsyncComponent} from "vue";
import App from "./App.vue";
const app = createApp(App);
const viteButton = defineAsyncComponent(()=> import('layout/Button').then(res => res.default));
app.component('vite-button', viteButton)
app.mount("#app");
