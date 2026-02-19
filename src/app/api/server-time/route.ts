import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date();
  // Format in Melbourne time (AEDT/AEST)
  const melbourneISO = now.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  return NextResponse.json({
    nowMs: now.getTime(),     // Unix ms — use this to calibrate client clock
    nowISO: now.toISOString(),
    melbourneISO,
    timezone: 'Australia/Melbourne',
  });
}
