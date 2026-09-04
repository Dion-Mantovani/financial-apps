import type { APIRoute } from 'astro';
import * as walletService from '../../services/wallets.service';

export const GET: APIRoute = async () => {
  try {
    const data = await walletService.getWallets();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Error' }),
      { status: err.status || 500 }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const data = await walletService.createWallet(body);
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
    const data = await walletService.editWallet(body);
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
    const data = await walletService.removeWallet(body);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Format JSON tidak valid' }),
      { status: err.status || 400 }
    );
  }
};
