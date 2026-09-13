import collapse from '@alpinejs/collapse';
import { initStores, bootstrapApp } from '../stores/app.store.js';

export default async (Alpine: any) => {
  Alpine.plugin(collapse);

  initStores(Alpine);

  await bootstrapApp();
};
