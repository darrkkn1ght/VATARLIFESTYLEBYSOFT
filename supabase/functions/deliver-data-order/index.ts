// Supabase Edge Function: deliver-data-order
// Integrates with VTpass (Nigeria) for automated MTN Daily & Weekly data delivery.
//
// Required Supabase Secrets (set via `supabase secrets set` or Dashboard -> Edge Functions -> Secrets):
//   VTPASS_API_KEY      = <your VTpass API key>
//   VTPASS_PUBLIC_KEY   = <your VTpass public key>
//   VTPASS_SECRET_KEY   = <your VTpass secret key>
//   VTPASS_ENV          = "live" | "sandbox"  (defaults to "sandbox" for safety)
//
// Automatically available in Supabase Edge Functions:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// VTpass requires request_id starting with YYYYMMDDHHII in Africa/Lagos (GMT+1)
function generateVtpassRequestId(suffix: string): string {
  const now = new Date();
  const lagosMs = now.getTime() + 60 * 60 * 1000;
  const lagos = new Date(lagosMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const prefix =
    `${lagos.getUTCFullYear()}${pad(lagos.getUTCMonth() + 1)}${pad(lagos.getUTCDate())}` +
    `${pad(lagos.getUTCHours())}${pad(lagos.getUTCMinutes())}`;
  const cleanSuffix = suffix.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  return `${prefix}${cleanSuffix}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 1. Verify caller identity & active admin status
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return jsonResponse({ error: 'Invalid or expired session.' }, 401);
    }

    const { data: isAdmin, error: adminErr } = await userClient.rpc('is_active_admin', {
      p_user_id: user.id,
    });

    if (adminErr || !isAdmin) {
      return jsonResponse({ error: 'Unauthorized: active administrator role required.' }, 403);
    }

    // 2. Read VTpass secrets
    const apiKey = (Deno.env.get('VTPASS_API_KEY') ?? '').trim();
    const publicKey = (Deno.env.get('VTPASS_PUBLIC_KEY') ?? '').trim();
    const secretKey = (Deno.env.get('VTPASS_SECRET_KEY') ?? '').trim();
    const vtpassEnv = (Deno.env.get('VTPASS_ENV') ?? 'sandbox').trim().toLowerCase();
    const baseUrl =
      vtpassEnv === 'live'
        ? 'https://vtpass.com/api'
        : 'https://sandbox.vtpass.com/api';

    if (!apiKey || !secretKey || !publicKey) {
      return jsonResponse(
        {
          error:
            'VTpass API keys are not configured yet. Add VTPASS_API_KEY, VTPASS_PUBLIC_KEY, VTPASS_SECRET_KEY, and VTPASS_ENV in Supabase Edge Function Secrets.',
          configured: false,
        },
        503,
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: 'balance' | 'variations' | 'deliver';
      orderId?: string;
    };

    // ACTION 1: Check live VTpass Wallet Balance
    if (body.action === 'balance') {
      const res = await fetch(`${baseUrl}/balance`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'public-key': publicKey,
        },
      });
      const data = await res.json().catch(() => ({}));
      const balance = Number(data?.contents?.balance ?? 0);
      return jsonResponse({
        ok: res.ok && data?.code === 1,
        balance,
        env: vtpassEnv,
        rawCode: data?.code,
      });
    }

    // ACTION 2: Fetch live VTpass MTN variation codes
    if (body.action === 'variations') {
      const res = await fetch(`${baseUrl}/service-variations?serviceID=mtn-data`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'public-key': publicKey,
        },
      });
      const data = await res.json().catch(() => ({}));
      const variations = Array.isArray(data?.content?.varations)
        ? data.content.varations
        : Array.isArray(data?.content?.variations)
          ? data.content.variations
          : [];
      return jsonResponse({ ok: res.ok, env: vtpassEnv, variations });
    }

    // ACTION 3: Deliver a Data Order via VTpass
    if (body.action === 'deliver' && body.orderId) {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      const { data: order, error: orderErr } = await serviceClient
        .from('data_orders')
        .select('*')
        .eq('id', body.orderId)
        .single();

      if (orderErr || !order) {
        return jsonResponse({ error: 'Data order not found.' }, 404);
      }

      if (order.status === 'delivered') {
        return jsonResponse({ error: 'This order has already been delivered.' }, 409);
      }

      if (order.status === 'delivering') {
        return jsonResponse({ error: 'This order is already being delivered.' }, 409);
      }

      const { data: plan, error: planErr } = await serviceClient
        .from('data_plans')
        .select('*')
        .eq('code', order.plan_code)
        .single();

      if (planErr || !plan) {
        return jsonResponse({ error: 'Associated data plan not found.' }, 404);
      }

      const requestId = order.vtu_request_id || generateVtpassRequestId(order.order_code);

      // Lock order to delivering + store idempotent requestId before calling VTpass
      const { error: lockErr } = await serviceClient
        .from('data_orders')
        .update({
          status: 'delivering',
          vtu_request_id: requestId,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .in('status', ['awaiting_transfer', 'transfer_sent', 'failed']);

      if (lockErr) {
        return jsonResponse({ error: `Could not lock order: ${lockErr.message}` }, 409);
      }

      // Call VTpass /api/pay
      const payRes = await fetch(`${baseUrl}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
          'secret-key': secretKey,
        },
        body: JSON.stringify({
          request_id: requestId,
          serviceID: plan.vtpass_service_id || 'mtn-data',
          billersCode: order.phone_number,
          variation_code: plan.vtpass_variation_code,
          phone: order.phone_number,
        }),
      });

      const payData = await payRes.json().catch(() => ({}));
      const code = String(payData?.code ?? '');
      const txStatus = String(payData?.content?.transactions?.status ?? '').toLowerCase();
      const txId = String(payData?.content?.transactions?.transactionId ?? payData?.requestId ?? requestId);
      const description = String(
        payData?.response_description || payData?.message || 'VTpass response received',
      );

      const isSuccess = code === '000' && (txStatus === 'delivered' || txStatus === 'successful' || txStatus === '');

      const finalStatus = isSuccess ? 'delivered' : 'failed';

      const { data: updatedOrder } = await serviceClient
        .from('data_orders')
        .update({
          status: finalStatus,
          vtu_reference: txId,
          vtu_response_note: `${description} (${vtpassEnv.toUpperCase()})`,
          delivered_at: isSuccess ? new Date().toISOString() : null,
        })
        .eq('id', order.id)
        .select('*')
        .single();

      await serviceClient.from('audit_logs').insert({
        actor_id: user.id,
        action: isSuccess ? 'data_order_auto_delivered' : 'data_order_auto_failed',
        entity_type: 'data_order',
        entity_id: order.id,
        target_user_id: order.buyer_id,
        metadata: {
          order_code: order.order_code,
          phone_number: order.phone_number,
          plan_label: order.plan_label,
          vtpass_code: code,
          vtu_reference: txId,
          response: description,
        },
      });

      if (!isSuccess) {
        return jsonResponse(
          {
            ok: false,
            error: `VTpass failed (${code}): ${description}`,
            order: updatedOrder,
          },
          400,
        );
      }

      return jsonResponse({
        ok: true,
        order: updatedOrder,
        reference: txId,
        message: `Delivered ${order.plan_label} to ${order.phone_number}!`,
      });
    }

    return jsonResponse({ error: 'Invalid action.' }, 400);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Unexpected server error.' },
      500,
    );
  }
});
