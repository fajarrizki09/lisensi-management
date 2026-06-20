import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = process.env.GAS_LICENSE_URL || process.env.NEXT_PUBLIC_API_URL || '';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'clipforge-telegram-webhook', target: GAS_URL ? 'configured' : 'missing' },
    { headers: corsHeaders() }
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!GAS_URL) {
      return NextResponse.json(
        { ok: false, success: false, message: 'GAS_LICENSE_URL belum diset di Vercel.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    const body = await request.text();
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      redirect: 'follow',
    });

    const text = await response.text();
    return new NextResponse(text || JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, success: false, message: error instanceof Error ? error.message : String(error) },
      { status: 200, headers: corsHeaders() }
    );
  }
}