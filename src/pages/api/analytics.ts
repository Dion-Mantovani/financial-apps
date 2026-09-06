// src/pages/api/analytics/index.ts
import type { APIRoute } from 'astro';
import * as analyticsService from '../../services/analytics.service';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const periodType = url.searchParams.get('periodType') || 'monthly';
    const date = url.searchParams.get('date') || '';

    const data = await analyticsService.getAnalyticsData(periodType, date);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Gagal memuat analitik' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
