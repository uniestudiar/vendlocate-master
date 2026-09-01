import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = { maxDuration: 30 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function getAuthedUser(authHeader, bodyJwt) {
  const tokenRaw = authHeader || bodyJwt || '';
  const token = tokenRaw.startsWith('Bearer ') ? tokenRaw.replace(/^Bearer\s+/i, '') : tokenRaw;
  if (!token) return { user: null, error: 'Missing token' };
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return { user: null, error: 'Invalid token' };
    return { user: data.user, error: null };
  } catch (e) {
    return { user: null, error: e?.message || 'Auth failed' };
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const bodyJwt = body?.userJwt || body?.accessToken || body?.jwt;

    const { user, error: authError } = await getAuthedUser(authHeader, bodyJwt);
    if (!user) return res.status(401).json({ error: authError || 'Unauthorized' });

    const { purchaseId, paymentIntentId } = body;
    if (!purchaseId) return res.status(400).json({ error: 'Missing purchaseId' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify payment with Stripe if it's a real payment
    if (paymentIntentId && !paymentIntentId.startsWith('pi_test_')) {
      try {
        if (!STRIPE_SECRET_KEY) throw new Error('Stripe not configured');
        const stripe = new Stripe(STRIPE_SECRET_KEY);
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ error: 'Payment has not been completed' });
        }
      } catch (stripeErr) {
        return res.status(500).json({ error: stripeErr?.message || 'Failed to verify payment' });
      }
    }

    // Update purchase to active
    const { error: updateError } = await supabase
      .from('purchases')
      .update({ status: 'active' })
      .eq('id', purchaseId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    // Update user location
    if (body.location) {
      const { data: existingLoc } = await supabase
        .from('user_locations')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .limit(1)
        .maybeSingle();

      const now = new Date().toISOString();
      if (existingLoc) {
        await supabase
          .from('user_locations')
          .update({
            radius_miles: body.radius,
            address: body.location.address || undefined,
            city: body.location.city || undefined,
            state: body.location.state || undefined,
            zip_code: body.location.zipCode || undefined,
            locked: true,
            locked_at: now,
          })
          .eq('id', existingLoc.id);
      } else if (body.location?.city) {
        await supabase.from('user_locations').insert({
          user_id: user.id,
          label: `${body.location.city}, ${body.location.state}`,
          address: body.location.address || '',
          city: body.location.city || '',
          state: body.location.state || '',
          zip_code: body.location.zipCode || null,
          radius_miles: body.radius || null,
          is_primary: true,
          locked: true,
          locked_at: now,
        });
      }

      await supabase.from('users').update({ location_locked: true, location_locked_at: now }).eq('id', user.id);
    }

    return res.status(200).json({ success: true, message: 'Purchase confirmed' });
  } catch (err) {
    console.error('confirm-purchase error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to confirm purchase' });
  }
}
