import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axawjnoxdlnbicnsxlwj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4YXdqbm94ZGxuYmljbnN4bHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjkzMzEsImV4cCI6MjA5NTg0NTMzMX0.FVg-2ah8ZK5AQwFhoLAubrxDO-Rxk4FzEiBRgZ9hb_I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const API_URL = `https://${supabaseUrl.split('//')[1].split('.')[0]}.supabase.co/functions/v1/make-server-de060722`;

export const VERCEL_API_URL = (() => {
  if (typeof window === 'undefined') return '/api';
  const origin = window.location.origin;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return `${origin}/api`;
  }
  return '/api';
})();

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  emailTemplate?: string;
}

export const getAuthHeader = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  } catch {
    return null;
  }
};

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const authHeader = await getAuthHeader();
  const isLongRunning =
    endpoint === '/generate-leads' ||
    endpoint === '/scan' ||
    ((options.method || 'GET').toUpperCase() === 'POST' && endpoint.includes('scan'));
  const timeoutMs = isLongRunning ? 300000 : 30000;

  const fetchWithTimeout = async (url: string) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  };

  try {
    const response = await fetchWithTimeout(`${API_URL}${endpoint}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (err: any) {
    const isNetworkError =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError') ||
      err?.message?.includes('aborted') ||
      err?.message?.includes('The user aborted');

    if (isNetworkError) {
      try {
        if (endpoint === '/generate-leads' && (options.method || 'GET').toUpperCase() === 'POST') {
          return await vercelScanCall(options);
        }
        return await directSupabaseCall(endpoint, options);
      } catch (fallbackErr: any) {
        throw new Error(
          `Edge Function unreachable (${err?.message || 'Failed to fetch'}). Fallback also failed: ${fallbackErr?.message || 'unknown error'}`
        );
      }
    }
    throw err;
  }
};

async function vercelScanCall(options: RequestInit) {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${VERCEL_API_URL}/scan`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Scan API request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

function getLocalUserId(): string | null {
  try {
    const raw = localStorage.getItem('vendlocate_current_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id || null;
  } catch {
    return null;
  }
}

function getLocalUserEmail(): string | null {
  try {
    const raw = localStorage.getItem('vendlocate_current_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.email || null;
  } catch {
    return null;
  }
}

async function directSupabaseCall(endpoint: string, options: RequestInit = {}) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const userId = authUser?.id || getLocalUserId();
  if (!userId) throw new Error('Not authenticated');

  if (endpoint === '/leads' && (!options.method || options.method === 'GET')) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { leads: data || [] };
  }

  if (endpoint === '/purchases' && (!options.method || options.method === 'GET')) {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false });
    if (error) throw error;
    return { purchases: data || [] };
  }

  if (endpoint === '/user-locations' && (!options.method || options.method === 'GET')) {
    const { data, error } = await supabase
      .from('user_locations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const { data: profile } = await supabase
      .from('users')
      .select('location_locked')
      .eq('id', userId)
      .single();
    return { locations: data || [], locationLocked: profile?.location_locked || false };
  }

  if (endpoint === '/email-history' && (!options.method || options.method === 'GET')) {
    const { data, error } = await supabase
      .from('email_history')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false });
    if (error) throw error;
    return { emails: data || [] };
  }

  if (endpoint === '/user-location' && options.method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { error } = await supabase
      .from('users')
      .update({
        search_address: body.location?.address || null,
        search_city: body.location?.city || null,
        search_state: body.location?.state || null,
        search_zip: body.location?.zipCode || null,
        preferred_radius_miles: body.preferredRadius || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) throw error;

    const { data: existingLoc } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    if (!existingLoc && body.location?.city) {
      await supabase.from('user_locations').insert({
        user_id: userId,
        label: `${body.location.city}, ${body.location.state}`,
        address: body.location.address || '',
        city: body.location.city || '',
        state: body.location.state || '',
        zip_code: body.location.zipCode || null,
        radius_miles: body.preferredRadius || null,
        is_primary: true,
        locked: false,
      });
    } else if (existingLoc) {
      await supabase.from('user_locations').update({
        address: body.location?.address || undefined,
        city: body.location?.city || undefined,
        state: body.location?.state || undefined,
        zip_code: body.location?.zipCode || undefined,
        radius_miles: body.preferredRadius || undefined,
        label: body.location?.city ? `${body.location.city}, ${body.location.state}` : undefined,
      }).eq('id', existingLoc.id);
    }

    return { success: true };
  }

  if (endpoint === '/user-location' && (!options.method || options.method === 'GET')) {
    const { data, error } = await supabase
      .from('users')
      .select('search_address, search_city, search_state, search_zip, preferred_radius_miles')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return {
      location: {
        address: data?.search_address || '',
        city: data?.search_city || '',
        state: data?.search_state || '',
        zipCode: data?.search_zip || '',
      },
      preferredRadius: data?.preferred_radius_miles || null,
    };
  }

  if (endpoint === '/outreach-settings' && options.method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { error } = await supabase
      .from('users')
      .update({
        phone: body.phone || null,
        outreach_email: body.outreachEmail || getLocalUserEmail() || '',
        smtp_app_password: body.smtpAppPassword || null,
        sender_name: body.senderName || null,
        email_template: body.emailTemplate || null,
        google_maps_api_key: body.googleMapsApiKey || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) throw error;
    return { success: true };
  }

  if (endpoint === '/outreach-settings' && (!options.method || options.method === 'GET')) {
    const { data, error } = await supabase
      .from('users')
      .select('phone, outreach_email, smtp_app_password, sender_name, email_template, google_maps_api_key')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return {
      settings: {
        phone: data?.phone || '',
        outreachEmail: data?.outreach_email || getLocalUserEmail() || '',
        smtpAppPassword: data?.smtp_app_password || '',
        senderName: data?.sender_name || 'Evan',
        emailTemplate: data?.email_template || '',
        googleMapsApiKey: data?.google_maps_api_key || '',
      },
    };
  }

  if (endpoint === '/search-settings' && options.method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { error } = await supabase
      .from('users')
      .update({
        preferred_radius_miles: body.radiusMeters ? Math.round(body.radiusMeters / 1609.34) : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) throw error;
    return { success: true };
  }

  if (endpoint === '/search-settings' && (!options.method || options.method === 'GET')) {
    const { data } = await supabase
      .from('users')
      .select('preferred_radius_miles, search_city, search_state')
      .eq('id', userId)
      .single();
    return {
      settings: {
        radiusMiles: data?.preferred_radius_miles || 10,
        city: data?.search_city || '',
        state: data?.search_state || '',
      },
    };
  }

  if (endpoint === '/user-locations/lock' && options.method === 'POST') {
    const now = new Date().toISOString();
    const { data: profile } = await supabase
      .from('users')
      .select('search_address, search_city, search_state, search_zip, preferred_radius_miles')
      .eq('id', userId)
      .single();

    const { data: existingLoc } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    if (!existingLoc && profile && (profile.search_address || profile.search_city)) {
      await supabase.from('user_locations').insert({
        user_id: userId,
        label: profile.search_city ? `${profile.search_city}, ${profile.search_state}` : profile.search_address,
        address: profile.search_address || '',
        city: profile.search_city || '',
        state: profile.search_state || '',
        zip_code: profile.search_zip || null,
        radius_miles: profile.preferred_radius_miles || null,
        is_primary: true,
        locked: true,
        locked_at: now,
      });
    } else if (existingLoc) {
      await supabase.from('user_locations').update({ locked: true, locked_at: now }).eq('id', existingLoc.id);
    }

    await supabase.from('users').update({ location_locked: true, location_locked_at: now }).eq('id', userId);
    return { success: true };
  }

  if (endpoint === '/user-locations/unlock' && options.method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { error } = await supabase.from('user_locations').insert({
      user_id: userId,
      label: body.city ? `${body.city}, ${body.state}` : body.address,
      address: body.address,
      city: body.city,
      state: body.state,
      zip_code: body.zipCode || null,
      radius_miles: body.preferredRadius || null,
      is_primary: false,
      locked: false,
    });
    if (error) throw error;
    return { success: true };
  }

  if (endpoint === '/create-payment-intent' && options.method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { data, error } = await supabase.from('purchases').insert({
      user_id: userId,
      radius_miles: body.radius,
      business_types: body.businessTypes || [],
      extra_selections: body.extraSelections || 0,
      premium_types: body.premiumTypes || [],
      total_price: body.totalPrice,
      location_address: body.location?.address || '',
      location_city: body.location?.city || '',
      location_state: body.location?.state || '',
      location_zip: body.location?.zipCode || '',
      stripe_payment_intent_id: 'pi_test_' + Date.now(),
      status: 'active',
    }).select().single();
    if (error) throw error;
    return { success: true, purchaseId: data.id };
  }

  if (endpoint === '/generate-leads' && options.method === 'POST') {
    const body = JSON.parse(options.body as string);
    const places = body.places || [];

    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('purchase_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!purchase?.id) throw new Error('No active purchase found.');

    const { data: loc } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    // Save discovered places as leads — with browser-side email scraping
    if (places.length > 0) {
      const seenPids = new Set<string>();
      let emailsFoundCount = 0;

      const leadRows = [];
      for (const p of places) {
        const website = (p.website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const name = (p.business_name || p.name || '').toLowerCase().trim();
        const city2 = (p.city || '').toLowerCase().trim();
        const pid =
          p.place_id ||
          (website && `web_${website}`) ||
          (name && city2 && `nm_${name}_${city2}`) ||
          (name && `nm_${name}`) ||
          null;
        if (!pid || seenPids.has(pid)) continue;
        seenPids.add(pid);

        let email: string | null = p.email || null;
        if (!email && p.website) {
          const { findEmailForBusiness } = await import('./emailFinder');
          const result = await findEmailForBusiness(p);
          if (result.email) {
            email = result.email;
            emailsFoundCount++;
          }
        }

        leadRows.push({
          purchase_id: purchase.id,
          user_id: userId,
          user_location_id: loc?.id || null,
          business_name: p.business_name || p.name || 'Unknown',
          business_type: p.business_type || 'General',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
          email,
          phone: p.phone || null,
          website: p.website || null,
          has_website: !!p.website,
          place_id: pid,
          profit_score: p.profit_score || estimateFallbackScore(p.business_name || '', p.business_type || ''),
          ranking: p.ranking || p.profit_score || estimateFallbackScore(p.business_name || '', p.business_type || ''),
          distance_from_client: p.distance || p.distance_from_client || 0,
          status: email ? 'new' : 'no_email',
        });
      }

      for (let i = 0; i < leadRows.length; i += 100) {
        const batch = leadRows.slice(i, i + 100);
        await supabase.from('leads').upsert(batch, {
          onConflict: 'place_id',
          ignoreDuplicates: true,
        });
      }

      const { data: allLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId);

      return {
        leads: allLeads || [],
        leadsFound: leadRows.length,
        emailsFound: emailsFoundCount,
        emailsSent: 0,
        success: true,
        message: `Saved ${leadRows.length} businesses to database (browser mode). Found ${emailsFoundCount} emails via scraping.`,
      };
    }

    const { data: allLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId);

    return {
      leads: allLeads || [],
      leadsFound: 0,
      emailsFound: 0,
      emailsSent: 0,
      success: true,
      message: 'No leads to process.',
    };
  }

  console.warn(`Direct Supabase fallback: no handler for ${endpoint}`);
  return { success: true };
}

function estimateFallbackScore(name: string, businessType: string): number {
  const lower = ((name || '') + ' ' + (businessType || '')).toLowerCase();
  let base = 55;
  let variance = 18;
  if (/apartment|complex|residential|housing|property|leasing/.test(lower)) { base = 90; variance = 8; }
  else if (/hospital|medical center|urgent care|clinic/.test(lower)) { base = 88; variance = 9; }
  else if (/gym|fitness|athletic/.test(lower)) { base = 85; variance = 10; }
  else if (/senior|retirement|assisted living|nursing/.test(lower)) { base = 90; variance = 7; }
  else if (/hotel|motel|inn|resort|guest|lodge/.test(lower)) { base = 87; variance = 10; }
  else if (/veterinary|vet|animal|pet/.test(lower)) { base = 80; variance = 12; }
  else if (/auto|repair|tire|mechanic/.test(lower)) { base = 72; variance = 12; }
  else if (/laundromat|laundry|wash|cleaner/.test(lower)) { base = 70; variance = 12; }
  else if (/salon|beauty|barber|spa|hair/.test(lower)) { base = 75; variance = 14; }
  else if (/restaurant|cafe|coffee|bar|pub|diner/.test(lower)) { base = 65; variance = 18; }
  return base + Math.floor(Math.random() * variance);
}
