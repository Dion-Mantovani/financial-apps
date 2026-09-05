// src/services/budgets.service.ts
import * as budgetQuery from '../query/budget.query';
import type { BudgetPayload, CopyBudgetPayload } from './apiClient';

export async function getBudgets(period: string) {
  return await budgetQuery.fetchBudgetsByPeriod(period);
}

export async function createBudget(payload: BudgetPayload) {
  if (!payload.category_id || !payload.amount) {
    throw { message: 'Kategori dan nominal wajib diisi', status: 400 };
  }
  return await budgetQuery.insertBudget(payload);
}

export async function editBudget(payload: BudgetPayload) {
  if (!payload.id) {
    throw { message: 'ID Budget tidak ditemukan', status: 400 };
  }
  return await budgetQuery.updateBudgetById(payload);
}

export async function removeBudget(id: string) {
  if (!id) {
    throw { message: 'ID Budget wajib disertakan', status: 400 };
  }
  return await budgetQuery.deleteBudgetById(id);
}

export async function copyBudget(payload: CopyBudgetPayload) {
  if (!payload.fromPeriod || !payload.toPeriod) {
    throw { message: 'Periode asal dan tujuan wajib diisi', status: 400 };
  }
  return await budgetQuery.copyBudgetsFromPeriod(
    payload.fromPeriod,
    payload.toPeriod
  );
}
