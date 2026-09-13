import accountStore from './account.store.js';
import categoryStore from './category.store.js';
import transactionStore from './transaction.store.js';
import { initialDataSync } from '../services/sync.service.js';

export const initStores = (Alpine) => {
  Alpine.store('accountStore', accountStore());
  Alpine.store('categoryStore', categoryStore());
  Alpine.store('transactionStore', transactionStore());
};

export const bootstrapApp = async () => {
  await initialDataSync();
};
