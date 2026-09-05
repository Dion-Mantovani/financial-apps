// src/pages/api/budgets/index.ts
import type { APIRoute } from 'astro';
import * as budgetService from '../../../services/budget.service';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const period =
      url.searchParams.get('period') || new Date().toISOString().slice(0, 7);
    const data = await budgetService.getBudgets(period);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const data = await budgetService.createBudget(body);
    return new Response(JSON.stringify(data), { status: 201 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Format JSON tidak valid' }),
      { status: err.status || 400 }
    );
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const data = await budgetService.editBudget(body);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Format JSON tidak valid' }),
      { status: err.status || 400 }
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const data = await budgetService.removeBudget(id || '');
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Format JSON tidak valid' }),
      { status: err.status || 400 }
    );
  }
};
