import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = process.env.GAS_LICENSE_URL || process.env.NEXT_PUBLIC_API_URL || '';

function getTelegramWebhookUrl(request: NextRequest) {
  const envUrl = process.env.TELEGRAM_WEBHOOK_URL || process.env.NEXT_PUBLIC_TELEGRAM_WEBHOOK_URL || '';
  if (envUrl) return envUrl.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  if (!host) return '';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/telegram`;
}

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
    if (!GAS_URL) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: 'GAS_LICENSE_URL belum diset di environment Vercel.',
          message: 'Set GAS_LICENSE_URL ke URL Google Apps Script Web App /exec.',
        },
        { status: 500, headers: corsHeaders() }
      );
    }

    const rawBody = await request.text();
    let body = rawBody;
    try {
      const payload = JSON.parse(rawBody || '{}');
      if ((payload.path === 'set-telegram-webhook' || payload.path === 'set-telegram-config') && !payload.web_app_url) {
        payload.web_app_url = getTelegramWebhookUrl(request) || GAS_URL;
      }
      body = JSON.stringify(payload);
    } catch (parseError) {}

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
