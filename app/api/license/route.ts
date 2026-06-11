import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = process.env.GAS_LICENSE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://script.google.com/macros/s/AKfycbwkKbuRhhsfD4IkMpDGNOrzX72RvtMTAimq_pJBM5RBaKxZUVun1cjjNDXjOGRT03q9BA/exec';

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
    {
      ok: true,
      service: 'clipforge-license-proxy',
      target: GAS_URL ? 'configured' : 'missing',
    },
    { headers: corsHeaders() }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body,
      redirect: 'follow',
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'License proxy gagal menghubungi server.',
      },
      { status: 502, headers: corsHeaders() }
    );
  }
}
