import type { APIRoute } from 'astro';
import * as transactionService from '../../services/transactions.service';

export const GET: APIRoute = async () => {
  try {
    const data = await transactionService.getTransactions();
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
    const data = await transactionService.createTransaction(body);
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
    const data = await transactionService.editTransaction(body);
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
    const body = await request.json();
    const data = await transactionService.removeTransaction(body);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Format JSON tidak valid' }),
      { status: err.status || 400 }
    );
  }
};
