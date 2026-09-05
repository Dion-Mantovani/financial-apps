// src/pages/api/budgets/copy.ts
import type { APIRoute } from 'astro';
import * as budgetService from '../../../services/budget.service';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const data = await budgetService.copyBudget(body);
    return new Response(JSON.stringify(data), { status: 201 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Format JSON tidak valid' }),
      { status: err.status || 400 }
    );
  }
};
