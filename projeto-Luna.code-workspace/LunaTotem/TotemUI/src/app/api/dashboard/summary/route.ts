export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildDashboardSummary } from '../summaryService';

export async function GET() {
  const summary = await buildDashboardSummary(false);
  return NextResponse.json(summary);
}
