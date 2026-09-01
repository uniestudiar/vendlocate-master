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
const TEST_USER_EMAIL = 'evanbaker127@gmail.com';

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

    const userEmail = user.email?.toLowerCase() || '';
    const isTestUser = userEmail === TEST_USER_EMAIL;

    if (!body.acceptedTerms) {
      return res.status(400).json({ error: 'You must accept the Terms of Service and No-Refund Policy to purchase.' });
    }

    const {
      radius,
      businessTypes,
      extraSelections,
      premiumTypes,
      totalPrice,
      location,
    } = body;

    // Server-side price validation
    const RADIUS_PRICES = { 5: 97, 10: 197, 15: 297, 20: 397, 30: 497 };
    const EXTRA_SELECTION_PRICE = 29;
    const PREMIUM_TYPE_PRICE = 49;

    const validRadius = typeof radius === 'number' && radius in RADIUS_PRICES;
    if (!validRadius) {
      return res.status(400).json({ error: 'Invalid radius' });
    }
    const basePrice = RADIUS_PRICES[radius as keyof typeof RADIUS_PRICES];
    const premiumCount = Array.isArray(premiumTypes) ? premiumTypes.length : 0;
    const extraCount = typeof extraSelections === 'number' ? extraSelections : 0;
    const expectedPrice = basePrice + premiumCount * PREMIUM_TYPE_PRICE + extraCount * EXTRA_SELECTION_PRICE;
    const clientPrice = typeof totalPrice === 'number' ? totalPrice : 0;

    if (clientPrice < expectedPrice) {
      return res.status(400).json({ error: 'Price mismatch - invalid total' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Check if this is an upgrade — get existing purchase
    const { data: existingPurchases } = await supabase
      .from('purchases')
      .select('id, radius_miles, total_price')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('purchase_date', { ascending: false })
      .limit(1);

    const existingPurchase = existingPurchases?.[0] || null;

    // Calculate the actual amount to charge (upgrade price, not full price)
    const previousPrice = existingPurchase?.total_price || 0;
    const chargeAmountCents = Math.max(0, Math.round((clientPrice - previousPrice) * 100));

    // TEST USER BYPASS: evanbaker127@gmail.com gets free purchases
    if (isTestUser) {
      const { data: purchase, error: insertError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          radius_miles: radius,
          business_types: businessTypes || [],
          extra_selections: extraSelections || 0,
          premium_types: premiumTypes || [],
          total_price: totalPrice || 0,
          location_address: location?.address || '',
          location_city: location?.city || '',
          location_state: location?.state || '',
          location_zip: location?.zipCode || '',
          stripe_payment_intent_id: 'pi_test_free_' + Date.now(),
          status: 'active',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.status(200).json({
        success: true,
        purchaseId: purchase.id,
        clientSecret: null,
        amount: 0,
        testBypass: true,
        message: 'Test account — purchase created for free.',
      });
    }

    // REAL PAYMENT: use Stripe
    if (!STRIPE_SECRET_KEY) {
      return res.status(400).json({
        error: 'Payment processing is not configured. Please contact evanbaker127@gmail.com.',
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Create a PaymentIntent with the calculated amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmountCents > 0 ? chargeAmountCents : 50, // minimum $0.50
      currency: 'usd',
      metadata: {
        user_id: user.id,
        user_email: user.email,
        radius: String(radius || ''),
        business_types: JSON.stringify(businessTypes || []),
        extra_selections: String(extraSelections || 0),
      },
    });

    // Save purchase record with pending status
    const { data: purchase, error: insertError } = await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        radius_miles: radius,
        business_types: businessTypes || [],
        extra_selections: extraSelections || 0,
        premium_types: premiumTypes || [],
        total_price: totalPrice || 0,
        location_address: location?.address || '',
        location_city: location?.city || '',
        location_state: location?.state || '',
        location_zip: location?.zipCode || '',
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      purchaseId: purchase.id,
      clientSecret: paymentIntent.client_secret,
      amount: chargeAmountCents,
      testBypass: false,
    });
  } catch (err) {
    console.error('create-payment-intent error:', err);
    return res.status(500).json({ error: err?.message || 'Payment failed' });
  }
}
