import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiCall, supabase } from '../utils/supabase';
import { discoverBusinessesMultiSource } from '../utils/osmDiscovery';
import { ALL_BUSINESS_TYPES, BusinessTypeDef } from '../utils/businessTypes';
import TermsModal from './TermsModal';
import {
  MapPin,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe,
  Filter,
  Search,
  TrendingUp,
  ArrowLeft,
  Send,
  Settings,
  CreditCard,
  Phone,
  KeyRound,
  Save,
  Loader2,
  Sliders,
  LogOut,
} from 'lucide-react';

interface Lead {
  id: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  email: string;
  phone: string;
  businessType: string;
  ranking: number;
  hasWebsite: boolean;
  websiteUrl?: string;
  emailSent: boolean;
  emailSentDate?: string;
  responded: boolean;
  responseDate?: string;
  followUpSent: boolean;
  followUpDate?: string;
  notes: string;
  estimatedFootTraffic: string;
  distanceFromClient: number;
  userLocationId?: string;
}

type TabType = 'dashboard' | 'filters' | 'noWebsites' | 'settings' | 'emailHistory';

interface OutreachSettings {
  phone: string;
  outreachEmail: string;
  smtpAppPassword: string;
  senderName: string;
  emailTemplate: string;
  googleMapsApiKey: string;
}

interface SearchSettings {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabledBusinessTypes: string[];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Dashboard — VendLocate Pro'; }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Only clear auth — preserve purchase/location/leads data
    localStorage.removeItem('vendlocate_current_user');
    navigate('/login');
  };

  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'responded' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'ranking' | 'date' | 'name'>('ranking');
  const [hasPaid, setHasPaid] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [settings, setSettings] = useState<OutreachSettings>({
    phone: '',
    outreachEmail: '',
    smtpAppPassword: '',
    senderName: 'Evan',
    emailTemplate: '',
    googleMapsApiKey: '',
  });
  const [searchSettings, setSearchSettings] = useState<SearchSettings>({
    latitude: 0,
    longitude: 0,
    radiusMeters: 22000,
    enabledBusinessTypes: [],
  });
  const [settingsStatus, setSettingsStatus] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingSearchSettings, setIsSavingSearchSettings] = useState(false);
  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('all');
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<{extraSelections: number; premiumTypes: string[]}>({extraSelections: 0, premiumTypes: []});
  const maxSelections = 5 + purchaseInfo.extraSelections;
  const [buyExtraSelections, setBuyExtraSelections] = useState(0);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buySuccess, setBuySuccess] = useState('');
  const [buyTermsAccepted, setBuyTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Editable location (can change until Run is clicked)
  const [editLocation, setEditLocation] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [showLocationEdit, setShowLocationEdit] = useState(false);
  const [currentRadiusMiles, setCurrentRadiusMiles] = useState(10);
  const [showRadiusUpgrade, setShowRadiusUpgrade] = useState(false);

  const [businessTypes, setBusinessTypes] = useState<BusinessTypeDef[]>(
    ALL_BUSINESS_TYPES.map(bt => ({ ...bt, enabled: ['laundromat', 'auto-shops', 'apartments', 'hotels', 'senior-communities'].includes(bt.id) }))
  );

  useEffect(() => {
    const loadDashboard = async () => {
      let supabaseUser = null;
      try {
        const result = await supabase.auth.getUser();
        supabaseUser = result.data?.user || null;
      } catch {
        // Supabase Auth unavailable — use local user only
      }
      const currentUser = localStorage.getItem('vendlocate_current_user');
      const user = supabaseUser || (currentUser ? JSON.parse(currentUser) : null);
      setIsAuthenticated(!!user);

      if (user?.email) {
        setSettings((current) => ({ ...current, outreachEmail: user.email }));
      }

      // Fetch user's saved locations
      try {
        const locResponse = await apiCall('/user-locations');
        const locs: any[] = locResponse.locations || [];

        // Check if any location is locked
        const locked = locs.some(l => l.locked) || locResponse.locationLocked;
        setIsLocationLocked(locked);
        setUserLocations(locs);
      } catch {
        setUserLocations([]);
      }

      // Load current search location from user profile
      try {
        const locRes = await apiCall('/user-location');
        if (locRes.location) {
          setEditLocation({
            address: locRes.location.address || '',
            city: locRes.location.city || '',
            state: locRes.location.state || '',
            zip: locRes.location.zipCode || '',
          });
        }
        if (locRes.preferredRadius) {
          setCurrentRadiusMiles(locRes.preferredRadius);
        }
      } catch {
        // Fall back to localStorage
        const savedLocation = localStorage.getItem('vendlocate_saved_location');
        if (savedLocation) {
          const parsed = JSON.parse(savedLocation);
          setEditLocation({
            address: parsed.address || '',
            city: parsed.city || '',
            state: parsed.state || '',
            zip: parsed.zipCode || '',
          });
        }
      }

      const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
      let localPurchase: any = null;

      if (user) {
        localPurchase = purchases.find((p: any) => p.userId === user.id) || null;
        // Fallback: match by email if userId doesn't match
        if (!localPurchase && user?.email) {
          localPurchase = purchases.find((p: any) => p.email === user.email) || null;
        }
      }

      // Fallback: use the latest purchase regardless of auth state
      if (!localPurchase && purchases.length > 0) {
        localPurchase = purchases[purchases.length - 1];
        // Restore user info from purchase so downstream code works
        if (!user && localPurchase) {
          localStorage.setItem('vendlocate_current_user', JSON.stringify({
            id: localPurchase.userId,
            email: localPurchase.email,
          }));
        }
      }

      if (localPurchase) {
        setPurchaseInfo({extraSelections: localPurchase.extraSelections || 0, premiumTypes: localPurchase.premiumTypes || []});
        setHasPaid(true);
        setCurrentRadiusMiles(localPurchase.radius || currentRadiusMiles);
      }

      try {
        const response = await apiCall('/purchases');
        if (!localPurchase) {
          setHasPaid((response.purchases || []).length > 0);
        }
        if (response.purchases && response.purchases.length > 0) {
          const p = response.purchases[0];
          setPurchaseInfo({extraSelections: p.extra_selections || 0, premiumTypes: p.premium_types || []});
          setHasPaid(true);
        }
      } catch {
        if (!localPurchase) {
          setHasPaid(false);
        }
      }

      const savedSettings = localStorage.getItem('vendlocate_outreach_settings');
      if (savedSettings) {
        setSettings((current) => ({ ...current, ...JSON.parse(savedSettings) }));
      }

      const savedSearchSettings = localStorage.getItem('vendlocate_search_settings');
      if (savedSearchSettings) {
        const parsed = JSON.parse(savedSearchSettings);
        setSearchSettings(parsed);
        // Restore business types from saved settings if available
        if (parsed.businessTypes && Array.isArray(parsed.businessTypes) && parsed.businessTypes.length > 0) {
          setBusinessTypes(parsed.businessTypes);
        }
      } else if (localPurchase?.businessTypes?.length) {
        // Fallback: restore business types from purchase data
        setBusinessTypes(prev => prev.map(bt => ({
          ...bt,
          enabled: localPurchase.businessTypes.includes(bt.id),
        })));
      }

      try {
        const response = await apiCall('/outreach-settings');
        if (response.settings) {
          setSettings((current) => ({
            ...current,
            phone: response.settings.phone || current.phone,
            outreachEmail: response.settings.outreachEmail || current.outreachEmail,
            smtpAppPassword: response.settings.smtpAppPassword || current.smtpAppPassword,
            senderName: response.settings.senderName || current.senderName,
            emailTemplate: response.settings.emailTemplate || current.emailTemplate,
            googleMapsApiKey: response.settings.googleMapsApiKey || current.googleMapsApiKey,
          }));
        }
      } catch {
        // Not authenticated — outreach settings unavailable
      }

      let leadsLoaded = false;
      try {
        let localUserId: string | null = null;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          localUserId = user?.id || null;
        } catch {}
        if (!localUserId) {
          try { localUserId = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}')?.id || null; } catch {}
        }
        if (localUserId) {
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('user_id', localUserId)
            .order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            const realLeads: Lead[] = data.map((lead: any) => ({
              id: lead.id,
              businessName: lead.business_name || 'Unknown Business',
              address: lead.address || '',
              city: lead.city || '',
              state: lead.state || '',
              zipCode: lead.zip_code || '',
              email: lead.email || 'Not found yet',
              phone: lead.phone || 'Not found yet',
              businessType: lead.business_type || 'General',
              ranking: lead.ranking || lead.profit_score || 0,
              hasWebsite: !!lead.has_website,
              websiteUrl: lead.website || undefined,
              emailSent: !!lead.email_sent,
              emailSentDate: lead.email_sent_date || undefined,
              responded: !!lead.responded,
              responseDate: lead.response_date || undefined,
              followUpSent: !!lead.follow_up_sent,
              followUpDate: lead.follow_up_date || undefined,
              notes: lead.notes || '',
              estimatedFootTraffic: lead.estimated_foot_traffic || 'Calculated during scan',
              distanceFromClient: Number(lead.distance_from_client || 0),
              userLocationId: lead.user_location_id || undefined,
            }));
            setLeads(realLeads);
            setFilteredLeads(realLeads);
            leadsLoaded = true;
          }
        }
      } catch {}

      if (!leadsLoaded) {
        // Fallback: load leads from localStorage
        const localLeads = JSON.parse(localStorage.getItem('vendlocate_leads') || '[]');
        if (localLeads.length > 0) {
          const mapped: Lead[] = localLeads.map((l: any, i: number) => ({
            id: l.id || String(i),
            businessName: l.business_name || l.name || 'Unknown Business',
            address: l.address || '',
            city: l.city || '',
            state: l.state || '',
            zipCode: l.zip_code || '',
            email: l.email || 'Not found yet',
            phone: l.phone || 'Not found yet',
            businessType: l.business_type || 'General',
            ranking: l.ranking || l.profit_score || 0,
            hasWebsite: !!l.has_website || !!l.website,
            websiteUrl: l.website || undefined,
            emailSent: false,
            responded: false,
            followUpSent: false,
            notes: l.notes || '',
            estimatedFootTraffic: 'Calculated during scan',
            distanceFromClient: Number(l.distance_from_client || 0),
          }));
          setLeads(mapped);
          setFilteredLeads(mapped);
        } else {
          setLeads([]);
          setFilteredLeads([]);
        }
      }

      // Fetch email history
      try {
        const emailResponse = await apiCall('/email-history');
        setEmailHistory(emailResponse.emails || []);
      } catch {
        setEmailHistory([]);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    let filteredTarget = leads;

    // Filter by selected user location
    if (selectedLocationId !== 'all') {
      const loc = userLocations.find(l => l.id === selectedLocationId);
      if (loc) {
        // First try filtering by user_location_id (most precise)
        const byLocationId = filteredTarget.filter(
          (lead: any) => (lead as any).userLocationId === selectedLocationId
        );
        if (byLocationId.length > 0) {
          filteredTarget = byLocationId;
        } else {
          // Fallback: filter by city + state match
          const cityLower = (loc.city || '').toLowerCase();
          const stateLower = (loc.state || '').toLowerCase();
          filteredTarget = filteredTarget.filter(
            (lead) =>
              lead.city.toLowerCase() === cityLower &&
              lead.state.toLowerCase() === stateLower
          );
        }
      }
    }

    let filtered = [...filteredTarget];

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.businessType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.city.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus === 'responded') {
      filtered = filtered.filter((lead) => lead.responded);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter((lead) => !lead.responded);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'ranking') return b.ranking - a.ranking;
      if (sortBy === 'date') {
        const dateA = new Date(a.emailSentDate || 0).getTime();
        const dateB = new Date(b.emailSentDate || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'name') return a.businessName.localeCompare(b.businessName);
      return 0;
    });

    setFilteredLeads(filtered);
  }, [leads, searchTerm, filterStatus, sortBy, selectedLocationId, userLocations]);

  const stats = {
    total: leads.length,
    emailsSent: leads.filter((l) => l.emailSent).length,
    responded: leads.filter((l) => l.responded).length,
    pending: leads.filter((l) => !l.responded).length,
  };

  const noWebsiteLeads = leads.filter((l) => !l.hasWebsite);


  const updateBusinessType = (id: string, updates: Partial<BusinessTypeDef>) => {
    setBusinessTypes(businessTypes.map((bt) => {
      if (bt.id === id && updates.enabled === true && !bt.enabled && !bt.isPremium) {
        const currentEnabled = businessTypes.filter(b => b.id !== id && b.enabled && !b.isPremium).length;
        if (currentEnabled >= maxSelections) return bt;
      }
      return bt.id === id ? { ...bt, ...updates } : bt;
    }));
  };

  const saveOutreachSettings = async () => {
    setSettingsStatus('');
    setIsSavingSettings(true);

    try {
      localStorage.setItem('vendlocate_outreach_settings', JSON.stringify(settings));
      await apiCall('/outreach-settings', {
        method: 'POST',
        body: JSON.stringify({
          phone: settings.phone,
          outreachEmail: settings.outreachEmail,
          smtpAppPassword: settings.smtpAppPassword,
          senderName: settings.senderName,
          emailTemplate: settings.emailTemplate,
        }),
      });
      setSettingsStatus('Settings saved to your account.');
    } catch {
      if (isAuthenticated) {
        setSettingsStatus('Settings saved locally. Check your internet connection for cloud sync.');
      } else {
        setSettingsStatus('Settings saved locally. Log in to save these settings to your account.');
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const saveSearchSettings = async () => {
    setIsSavingSearchSettings(true);
    try {
      const enabledTypes = businessTypes.filter((bt) => bt.enabled).map((bt) => bt.name);
      const updatedSearchSettings = {
        ...searchSettings,
        enabledBusinessTypes: enabledTypes,
        businessTypes: businessTypes,
      };
      localStorage.setItem('vendlocate_search_settings', JSON.stringify(updatedSearchSettings));
      await apiCall('/search-settings', {
        method: 'POST',
        body: JSON.stringify(updatedSearchSettings),
      });
      setSettingsStatus('Search settings saved to your account.');
    } catch {
      setSettingsStatus('Search settings saved locally. Check your internet connection.');
    } finally {
      setIsSavingSearchSettings(false);
    }
  };

  const handleInlinePurchase = async () => {
    if (!buyTermsAccepted) {
      setBuyError('You must agree to the Terms of Service and No-Refund Policy to purchase.');
      setIsBuying(false);
      return;
    }
    setIsBuying(true);
    setBuyError('');
    setBuySuccess('');

    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
    const isTestUser = currentUser.email === 'evanbaker127@gmail.com';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
      const userPurchase = purchases.find((p: any) => p.userId === currentUser.id);

      // Build full purchase state with new extras added
      const newExtraSelections = (userPurchase?.extraSelections || 0) + buyExtraSelections;
      const existingBts = userPurchase?.businessTypes || [];
      const allPremiumTypes = businessTypes.filter(bt => bt.isPremium);
      const currentPremiumTypes = allPremiumTypes.filter(bt => bt.enabled).map(bt => bt.id);
      const radiusPrices: Record<number, number> = { 5: 97, 10: 197, 15: 297, 20: 397, 30: 497 };
      const basePrice = radiusPrices[userPurchase?.radius || currentRadiusMiles] || 197;
      const premiumPrice = allPremiumTypes.filter(bt => bt.enabled).reduce((sum, bt) => sum + (bt.premiumPrice || 0), 0);
      const newTotalPrice = basePrice + premiumPrice + newExtraSelections * 29;

      const locationPayload = userPurchase?.location
        ? userPurchase.location
        : { address: editLocation.address, city: editLocation.city, state: editLocation.state, zipCode: editLocation.zip };
      const payload = {
        radius: userPurchase?.radius || currentRadiusMiles,
        businessTypes: existingBts,
        extraSelections: newExtraSelections,
        premiumTypes: currentPremiumTypes,
        totalPrice: newTotalPrice,
        location: locationPayload,
        acceptedTerms: true,
      };

      const resp = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Purchase failed');

      if (data.testBypass) {
        // Update localStorage purchase record
        const newPurchases = purchases.map((p: any) => {
          if (p.userId === currentUser.id) {
            return { ...p, extraSelections: newExtraSelections, totalPrice: newTotalPrice };
          }
          return p;
        });
        if (!newPurchases.find((p: any) => p.userId === currentUser.id)) {
          newPurchases.push({
            id: data.purchaseId || Date.now().toString(),
            userId: currentUser.id,
            email: currentUser.email,
            radius: userPurchase?.radius || currentRadiusMiles,
            businessTypes: existingBts,
            extraSelections: newExtraSelections,
            premiumTypes: currentPremiumTypes,
            location: userPurchase?.location || editLocation,
            totalPrice: newTotalPrice,
            purchaseDate: new Date().toISOString(),
          });
        }
        localStorage.setItem('vendlocate_purchases', JSON.stringify(newPurchases));

        setPurchaseInfo(prev => ({ ...prev, extraSelections: newExtraSelections, premiumTypes: currentPremiumTypes }));
        setBuyExtraSelections(0);
        setBuySuccess(`Added ${buyExtraSelections} extra selection${buyExtraSelections > 1 ? 's' : ''}!`);
      } else {
        // Real user — store intent and redirect to pricing
        localStorage.setItem('vendlocate_pending_upgrade', JSON.stringify({
          extraSelections: buyExtraSelections,
          timestamp: Date.now(),
        }));
        navigate('/pricing?action=add-selections');
      }
    } catch (err: any) {
      setBuyError(err.message);
    } finally {
      setIsBuying(false);
    }
  };

  const addTerminalLine = (line: string) => {
    const ts = `[${new Date().toLocaleTimeString()}] ${line}`;
    setTerminalLines(prev => {
      const next = [...prev, ts];
      localStorage.setItem('vendlocate_scan_state', JSON.stringify({
        isRunning: true,
        terminalLines: next,
        timestamp: Date.now(),
      }));
      return next;
    });
    document.title = `Scanning... | VendLocate`;
  };

  // Restore scan state on mount
  useEffect(() => {
    const saved = localStorage.getItem('vendlocate_scan_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.terminalLines?.length > 0) {
          setTerminalLines(state.terminalLines);
          setShowTerminal(true);
        }
      } catch {}
    }
  }, []);

  const handleRunScan = async () => {
    try {
    if (!isLocationLocked) {
      const locText = editLocation.address || editLocation.city
        ? `${editLocation.address || ''}, ${editLocation.city || '—'}, ${editLocation.state || '—'} ${editLocation.zip || ''}`
        : 'Not set';
      const confirm = window.confirm(
        `WARNING: Your location will be PERMANENTLY locked after this run.\n\n` +
        `Location: ${locText}\n` +
        `Radius: ${currentRadiusMiles} miles\n\n` +
        `You will NOT be able to change this location without paying $97.\n\n` +
        `Click OK to lock and run, or Cancel to go back.`
      );
      if (!confirm) return;
    }

    // Validate phone + Gmail app password before scan
    if (!settings.phone || settings.phone.length < 10) {
      alert('Please add your phone number in the Settings tab before running a scan.\n\nGo to Settings → Outreach Settings → Phone Number.');
      return;
    }
    if (!settings.smtpAppPassword || settings.smtpAppPassword.length < 10) {
      alert('Please set your Gmail App Password in the Settings tab before running a scan.\n\nThis is NOT your Gmail password — it is a 16-character app-specific password generated from your Google Account.\n\nGo to Settings → Outreach Settings → Gmail App Password.');
      return;
    }

    setIsRunning(true);
    setShowTerminal(true);
    setTerminalLines([]);
    setRunStatus('Running...');
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    addTerminalLine('=== VENDLOCATE ENGINE START ===');
    addTerminalLine(`Time: ${new Date().toLocaleString()}`);
    const startTime = Date.now();
    await delay(200);

    // ── Phase 1: Save & lock location ──
    addTerminalLine('--- PHASE 1: LOCATION ---');
    addTerminalLine('Saving search location...');
    if (!isLocationLocked) {
      try {
        await apiCall('/user-location', {
          method: 'POST',
          body: JSON.stringify({
            location: { address: editLocation.address, city: editLocation.city, state: editLocation.state, zipCode: editLocation.zip },
            preferredRadius: currentRadiusMiles,
          }),
        });
        addTerminalLine(`Location saved: ${editLocation.city || 'N/A'}, ${editLocation.state || 'N/A'}`);
      } catch { addTerminalLine('Saved location to your account'); }
      try {
        await apiCall('/user-locations/lock', { method: 'POST' });
        setIsLocationLocked(true);
        addTerminalLine('Location locked permanently');
      } catch { addTerminalLine('Locked location on your account'); }
    } else {
      addTerminalLine('Location already locked.');
    }
    await delay(200);

    // ── Phase 2: Geocode location ──
    addTerminalLine('--- PHASE 2: GEOCODING ---');
    let lat = 39.78; let lng = -89.65;
    const searchQuery = [editLocation.city, editLocation.state].filter(Boolean).join(', ');
    if (searchQuery) {
      addTerminalLine(`Geocoding: ${searchQuery}`);
      try {
        const geoResp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`, {
          headers: { 'User-Agent': 'VendLocate/1.0' },
        });
        const geoData = await geoResp.json();
        if (geoData.length > 0) {
          lat = parseFloat(geoData[0].lat);
          lng = parseFloat(geoData[0].lon);
          addTerminalLine(`Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } else {
          addTerminalLine('Geocoding failed, using default coordinates');
        }
      } catch {
        addTerminalLine('Geocoding service unavailable, using default coordinates');
      }
    }
    await delay(200);

    // ── Phase 3: DISCOVERY ──
    addTerminalLine('--- PHASE 3: DISCOVERY ---');
    addTerminalLine(`Searching within ${currentRadiusMiles} miles of ${editLocation.city || 'your location'}...`);
    const enabledTypes = businessTypes.filter(bt => bt.enabled);
    addTerminalLine(`Enabled types: ${enabledTypes.map(bt => bt.name).join(', ')}`);

    await delay(50);

    let directSaveEmailsFound = 0;
    const discoveredPlaces: any[] = [];
    const seenOsmIds = new Set<string>();
    const radiusMeters = currentRadiusMiles * 1609.34;
    const existingPlaceNames = new Set<string>();

    // Load existing leads from DB so we skip discovery for already-known places (saves API tokens)
    let localUserId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      localUserId = user?.id || null;
    } catch {}
    if (!localUserId) {
      try { localUserId = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}')?.id || null; } catch {}
    }
    if (localUserId) {
      try {
        const { data: existing } = await supabase
          .from('leads')
          .select('place_id, business_name, city, state')
          .eq('user_id', localUserId);
        if (existing) {
          for (const row of existing) {
            if (row.place_id) seenOsmIds.add(row.place_id);
            existingPlaceNames.add(`${(row.business_name || '').toLowerCase().trim()}|${(row.city || '').toLowerCase().trim()}|${(row.state || '').toLowerCase().trim()}`);
          }
          addTerminalLine(`  Found ${existing.length} existing leads — skipping them in discovery to save API tokens`);
        }
      } catch (e) {
        console.error('Failed to load existing leads for dedup:', e);
      }
    }

    const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 3959;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
    };

    for (const bt of enabledTypes) {
      if (discoveredPlaces.length >= 5000) break;
      addTerminalLine(`  Searching for "${bt.name}"...`);
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timed out after 180s')), 180000)
        );
        const places = await Promise.race([
          discoverBusinessesMultiSource({
            businessType: bt,
            lat,
            lng,
            radiusMeters,
            centerCity: editLocation.city,
            centerState: editLocation.state,
            perTypeLimit: 500,
            onProgress: (p: any) => {
              if (p.stage === 'google_places') addTerminalLine(`    Google Places: ${p.found} results`);
              if (p.stage === 'google_quota') addTerminalLine(`    ⚠ Google quota exhausted — switching to Overture`);
              if (p.stage === 'overture') addTerminalLine(`    Overture: ${p.found} results`);
              if (p.stage === 'osm_bbox') addTerminalLine(`    OSM bbox — ${p.found} total`);
              if (p.stage === 'osm_retry') addTerminalLine(`    ${p.message}`);
            },
          }),
          timeoutPromise,
        ]);
        let added = 0;
        for (const p of places) {
          if (discoveredPlaces.length >= 5000) break;
          if (!p.place_id || seenOsmIds.has(p.place_id)) continue;
          seenOsmIds.add(p.place_id);
          const nameKey = `${(p.business_name || '').toLowerCase().trim()}|${(p.city || '').toLowerCase().trim()}|${(p.state || '').toLowerCase().trim()}`;
          if (existingPlaceNames.has(nameKey)) continue;
          const placeDistance = typeof p.distance === 'number' && p.distance > 0
            ? p.distance
            : (typeof p.lat === 'number' && typeof p.lng === 'number'
              ? haversineMiles(lat, lng, p.lat, p.lng)
              : 0);
          discoveredPlaces.push({
            business_name: p.business_name,
            business_type: bt.name || 'General',
            address: p.address || '',
            city: p.city || editLocation.city || '',
            state: p.state || editLocation.state || '',
            website: p.website || null,
            phone: p.phone || null,
            place_id: p.place_id,
            lat: p.lat,
            lng: p.lng,
            distance: placeDistance,
          });
          added += 1;
        }
        addTerminalLine(`    +${added} unique ${bt.name} businesses`);
      } catch (e: any) {
        addTerminalLine(`  ⚠ Search error for "${bt.name}": ${e?.message || 'timeout'}`);
      }
      await delay(50);
    }

    addTerminalLine(`Total businesses discovered: ${discoveredPlaces.length}`);

    // Send discovered places to engine for email scraping + persistence
    addTerminalLine('');
    addTerminalLine('Saving businesses to database with email discovery...');

    let saveResult: any = null;
    if (discoveredPlaces.length > 0) {
      try {
        saveResult = await saveDiscoveredPlacesDirectly(discoveredPlaces);
        directSaveEmailsFound = saveResult?.emailsFound || 0;
        const savedCount = saveResult?.savedCount || 0;
        addTerminalLine(`Saved ${savedCount} businesses to database. Found ${directSaveEmailsFound} emails.`);
      } catch (err: any) {
        addTerminalLine(`⚠ Save error: ${err?.message || 'unknown'}`);
      }
    } else {
      addTerminalLine('No discoveries — check your enabled business types and location.');
    }

    // ── Phase 5: Load results ──
    addTerminalLine('--- PHASE 5: LOADING RESULTS ---');
    addTerminalLine('Loading leads into dashboard...');
    try {
      if (saveResult?.leads && saveResult.leads.length > 0) {
        setLeads(saveResult.leads);
        setFilteredLeads(saveResult.leads);
        addTerminalLine(`Loaded ${saveResult.leads.length} leads into dashboard.`);
      } else {
        // Fallback: try Supabase directly
        addTerminalLine('Checking database for leads...');
        let localUserId: string | null = null;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          localUserId = user?.id || null;
        } catch {}
        if (!localUserId) {
          try { localUserId = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}')?.id || null; } catch {}
        }
        if (localUserId) {
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('user_id', localUserId)
            .order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            const mapped = data.map((lead: any) => ({
              id: lead.id || String(Math.random()),
              businessName: lead.business_name || 'Unknown Business',
              address: lead.address || '',
              city: lead.city || '',
              state: lead.state || '',
              zipCode: lead.zip_code || '',
              email: lead.email || 'Not found yet',
              phone: lead.phone || 'Not found yet',
              businessType: lead.business_type || 'General',
              ranking: lead.ranking || lead.profit_score || 0,
              hasWebsite: !!lead.has_website,
              websiteUrl: lead.website || undefined,
              emailSent: !!lead.email_sent,
              emailSentDate: lead.email_sent_date || undefined,
              responded: !!lead.responded,
              responseDate: lead.response_date || undefined,
              followUpSent: !!lead.follow_up_sent,
              followUpDate: lead.follow_up_date || undefined,
              notes: lead.notes || '',
              estimatedFootTraffic: lead.estimated_foot_traffic || 'Calculated during scan',
              distanceFromClient: Number(lead.distance_from_client || 0),
              userLocationId: lead.user_location_id || undefined,
            }));
            setLeads(mapped);
            setFilteredLeads(mapped);
            addTerminalLine(`Loaded ${mapped.length} leads from database.`);
          } else {
            addTerminalLine('Leads saved — they will appear on next page load.');
          }
        } else {
          addTerminalLine('Leads saved — they will appear on next page load.');
        }
      }
    } catch {
      addTerminalLine('Leads saved — reload the page to see them.');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    addTerminalLine('');
    addTerminalLine('=== SCAN FINISHED ===');
    addTerminalLine(`Time: ${elapsed}s | Discovered: ${discoveredPlaces.length} | Emails found: ${directSaveEmailsFound}`);

    setRunStatus(`Done! ${discoveredPlaces.length} businesses found, ${directSaveEmailsFound} emails. (${elapsed}s)`);
    setIsRunning(false);
    document.title = 'Lead Dashboard | VendLocate';
    // Mark scan as finished in localStorage
    localStorage.setItem('vendlocate_scan_state', JSON.stringify({
      isRunning: false,
      terminalLines: [],
      timestamp: Date.now(),
    }));
    } catch (e) {
      console.error('Scan error:', e);
      addTerminalLine(`❌ Scan failed: ${e?.message || 'Unknown error'}`);
      setIsRunning(false);
      document.title = 'Lead Dashboard | VendLocate';
    }
  };

  // Save discovered places directly to Supabase when Edge Function is unavailable
  const saveDiscoveredPlacesDirectly = async (places: any[]) => {
    let localUserId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      localUserId = user?.id || null;
    } catch {}
    if (!localUserId) {
      try {
        const raw = localStorage.getItem('vendlocate_current_user');
        if (raw) localUserId = JSON.parse(raw)?.id || null;
      } catch {}
    }
    if (!localUserId) return;

    // Check for existing places in database to avoid duplicates and save API tokens
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('place_id, business_name, city, state')
      .eq('user_id', localUserId);
    const existingPlaceIds = new Set((existingLeads || []).map(l => l.place_id));
    const existingNames = new Set((existingLeads || []).map(l => `${l.business_name.toLowerCase()}|${l.city.toLowerCase()}|${l.state.toLowerCase()}`));
    addTerminalLine(`  Found ${existingPlaceIds.size} existing leads in database — skipping duplicates`);

    // Try Supabase purchase first, fall back to localStorage
    let purchaseId: string | null = null;
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', localUserId)
      .eq('status', 'active')
      .order('purchase_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (purchase?.id) {
      purchaseId = purchase.id;
    } else {
      try {
        const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
        const localPurchase = purchases.find((p: any) => p.userId === localUserId);
        if (localPurchase?.id) purchaseId = localPurchase.id;
      } catch {}
    }
    // For test user, skip purchase requirement and use placeholder purchase_id
    if (!purchaseId) {
      const isTestUser = (() => {
        try {
          const u = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
          return u.email === 'evanbaker127@gmail.com';
        } catch { return false; }
      })();
      if (!isTestUser) {
        addTerminalLine('⚠ No purchase found — create one via Pricing page first.');
        return;
      }
      purchaseId = 'purch_test_' + localUserId;
      addTerminalLine('✓ Test user — proceeding without purchase record.');
    }

    const { data: loc } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', localUserId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    const seenPids = new Set<string>();
    const leadRows: any[] = [];
    let emailsFound = 0;
    let skippedCount = 0;

    // First pass: collect leads and identify which need email finding
    const websiteBatches: { place: any; idx: number }[] = [];
    for (const p of places) {
      if (leadRows.length >= 5000) break;
      const website = (p.website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const name = (p.business_name || p.name || '').toLowerCase().trim();
      const city = (p.city || '').toLowerCase().trim();
      const state = (p.state || '').toLowerCase().trim();
      const pid =
        p.place_id ||
        (website && `web_${website}`) ||
        (name && city && `nm_${name}_${city}`) ||
        (name && `nm_${name}`) ||
        null;
      if (!pid || seenPids.has(pid) || existingPlaceIds.has(pid)) {
        if (existingPlaceIds.has(pid)) skippedCount++;
        continue;
      }
      // Also check by name+city+state combo
      const nameKey = `${name}|${city}|${state}`;
      if (existingNames.has(nameKey)) {
        skippedCount++;
        continue;
      }
      seenPids.add(pid);

      const distance = typeof p.distance === 'number' ? parseFloat(p.distance.toFixed(2)) : 0;

      leadRows.push({
        purchase_id: purchaseId,
        user_id: localUserId,
        user_location_id: loc?.id || null,
        business_name: p.business_name || p.name || 'Unknown',
        business_type: p.business_type || 'General',
        address: p.address || '',
        city: p.city || '',
        state: p.state || '',
        zip_code: p.zip_code || p.zipCode || '',
        email: null,
        phone: p.phone || null,
        website: p.website || null,
        has_website: !!p.website,
        place_id: pid,
        profit_score: p.profit_score || estimateProfitScore(p.business_name || '', p.business_type || ''),
        ranking: p.ranking || p.profit_score || estimateProfitScore(p.business_name || '', p.business_type || ''),
        distance_from_client: distance,
        status: 'no_email',
        _place: p,
      });

      if (p.website && !p.email) {
        websiteBatches.push({ place: p, idx: leadRows.length - 1 });
      }
    }

    if (skippedCount > 0) {
      addTerminalLine(`  Skipped ${skippedCount} duplicate businesses already in database`);
    }

    // Try to find websites for businesses without one (batched)
    const noWebsiteBatch: { place: any; idx: number }[] = [];
    for (let i = 0; i < leadRows.length; i++) {
      const row = leadRows[i];
      if (!row.website) {
        noWebsiteBatch.push({ place: row._place, idx: i });
      }
    }
    if (noWebsiteBatch.length > 0) {
      addTerminalLine(`  Searching for websites of ${noWebsiteBatch.length} businesses...`);
      for (let i = 0; i < noWebsiteBatch.length; i += 5) {
        const batch = noWebsiteBatch.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(entry =>
            fetch('/api/find-website', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                businessName: entry.place.business_name,
                city: entry.place.city,
                state: entry.place.state,
              }),
              signal: AbortSignal.timeout(20000),
            }).then(async resp => {
              if (!resp.ok) return null;
              const result = await resp.json();
              return result.url || null;
            })
          )
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled' && r.value) {
            const decoded = r.value;
            if (decoded.startsWith('http') && !decoded.includes('facebook') && !decoded.includes('yelp') && !decoded.includes('instagram') && !decoded.includes('twitter')) {
              const entry = batch[j];
              leadRows[entry.idx].website = decoded;
              leadRows[entry.idx].has_website = true;
              leadRows[entry.idx]._place.website = decoded;
              websiteBatches.push({ place: leadRows[entry.idx]._place, idx: entry.idx });
              addTerminalLine(`  🌐 Found website for ${entry.place.business_name}`);
            }
          }
        }
      }
    }

    // Find emails for all businesses with websites in parallel (batches of 10)
    if (websiteBatches.length > 0) {
      addTerminalLine(`  Finding emails for ${websiteBatches.length} businesses with websites...`);
      const { findEmailForBusiness } = await import('../utils/emailFinder');
      for (let i = 0; i < websiteBatches.length; i += 10) {
        const batch = websiteBatches.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(b => findEmailForBusiness(b.place))
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled' && r.value?.email) {
            const idx = batch[j].idx;
            leadRows[idx].email = r.value.email;
            leadRows[idx].status = 'new';
            leadRows[idx].email_verified = r.value.smtpVerified;
            emailsFound++;
            if (emailsFound <= 5) {
              addTerminalLine(`  📧 ${r.value.email} (${leadRows[idx].business_name} — ${r.value.method}${r.value.smtpVerified ? '' : ' unverified'})`);
            } else if (emailsFound === 6) {
              addTerminalLine(`  ... and ${websiteBatches.length - 5} more`);
            }
          }
        }
      }
    }

    // Strip _place helper before upsert
    const cleanRows = leadRows.map(({ _place, ...rest }) => ({
      ...rest,
      zip_code: rest.zip_code || null,
      email: rest.email || null,
      phone: rest.phone || null,
      website: rest.website || null,
    }));

    let upsertErrors = 0;
    let savedCount = 0;
    for (let i = 0; i < cleanRows.length; i += 100) {
      const batch = cleanRows.slice(i, i + 100);
      const { error: upsertError } = await supabase
        .from('leads')
        .upsert(batch, { onConflict: 'place_id', ignoreDuplicates: true });
      if (upsertError) {
        upsertErrors++;
        console.error('Leads upsert batch error:', upsertError);
        addTerminalLine(`⚠ Batch ${i / 100 + 1} failed (${upsertError.message || upsertError.code}), retrying individually...`);
        for (const row of batch) {
          const { error: singleError } = await supabase
            .from('leads')
            .upsert(row, { onConflict: 'place_id', ignoreDuplicates: true });
          if (!singleError) savedCount++;
        }
      } else {
        savedCount += batch.length;
      }
    }
    if (upsertErrors > 0) {
      addTerminalLine(`✓ ${savedCount}/${cleanRows.length} leads saved (${upsertErrors} batches had errors, skipped per-row)`);
    } else {
      addTerminalLine(`✓ All ${cleanRows.length} leads saved successfully`);
    }

    // Cache to localStorage so it loads on page refresh
    try {
      localStorage.setItem('vendlocate_leads', JSON.stringify(cleanRows));
    } catch {}

    // Map to Lead[] format for the frontend
    const mappedLeads: Lead[] = cleanRows.map((lead: any) => ({
      id: lead.place_id || String(Math.random()),
      businessName: lead.business_name || 'Unknown Business',
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      zipCode: lead.zip_code || '',
      email: lead.email || 'Not found yet',
      phone: lead.phone || 'Not found yet',
      businessType: lead.business_type || 'General',
      ranking: lead.ranking || lead.profit_score || 0,
      hasWebsite: !!lead.has_website,
      websiteUrl: lead.website || undefined,
      emailSent: !!lead.email_sent,
      emailSentDate: lead.email_sent_date || undefined,
      responded: !!lead.responded,
      responseDate: lead.response_date || undefined,
      followUpSent: !!lead.follow_up_sent,
      followUpDate: lead.follow_up_date || undefined,
      notes: lead.notes || '',
      estimatedFootTraffic: lead.estimated_foot_traffic || 'Calculated during scan',
      distanceFromClient: Number(lead.distance_from_client || 0),
      userLocationId: lead.user_location_id || undefined,
    }));

    return { emailsFound, savedCount: cleanRows.length, leads: mappedLeads };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Home
              </Link>
              <div className="flex items-center gap-3">
                <MapPin className="w-8 h-8 text-indigo-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Lead Dashboard</h1>
                  <p className="text-sm text-gray-600">Manage and track your vending location leads</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isAuthenticated && hasPaid && (
                  <button
                    onClick={handleRunScan}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Run
                      </>
                    )}
                  </button>
                )}
                <a
                  href="mailto:evanbaker127@gmail.com"
                  className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
                >
                  Contact Us
                </a>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentTab('filters')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'filters'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Sliders className="w-4 h-4 inline mr-2" />
              Search Settings
            </button>
            <button
              onClick={() => setCurrentTab('noWebsites')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'noWebsites'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Globe className="w-4 h-4 inline mr-2" />
              No Websites ({noWebsiteLeads.length})
            </button>
            <button
              onClick={() => setCurrentTab('settings')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Database
            </button>
            <button
              onClick={() => setCurrentTab('emailHistory')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                currentTab === 'emailHistory'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-2" />
              Email History ({emailHistory.length})
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {currentTab === 'dashboard' && (
          <>
            {!hasPaid && (
              <div className="bg-white rounded-lg shadow-sm border border-indigo-100 p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Preview the lead engine before you buy</h2>
                    <p className="text-gray-600 mt-1">
                      Buy a search package, enter your location once, and the database will fill automatically after
                      the lead program runs.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(isAuthenticated ? '/pricing' : '/register')}
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <CreditCard className="w-5 h-5" />
                    Unlock Your Area
                  </button>
                </div>
              </div>
            )}

            {isLocationLocked && (
              <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Location Locked</h2>
                      <p className="text-gray-600 mt-1">
                        Your search location is locked. To change or add a new location, purchase an additional slot.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/pricing?action=new-location')}
                    className="inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                  >
                    <CreditCard className="w-5 h-5" />
                    Add New Location ($97)
                  </button>
                </div>
              </div>
            )}

            {/* Editable Location Section (before Run locks it) */}
            {!isLocationLocked && hasPaid && (
              <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 mb-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Your Search Location</h2>
                      <p className="text-gray-600 mt-1">
                        You can change your location until you click <strong>Run</strong>. After that, it's locked permanently.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLocationEdit(!showLocationEdit)}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    {showLocationEdit ? 'Done Editing' : 'Edit Location'}
                  </button>
                </div>

                {!showLocationEdit ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-700">
                      <strong>Current:</strong> {editLocation.address || 'Not set'}, {editLocation.city || '—'}, {editLocation.state || '—'} {editLocation.zip || ''}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Search radius: <strong>{currentRadiusMiles} miles</strong>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                      <input
                        type="text"
                        value={editLocation.address}
                        onChange={(e) => setEditLocation({ ...editLocation, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="123 Main St"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={editLocation.city}
                          onChange={(e) => setEditLocation({ ...editLocation, city: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          placeholder="Springfield"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={editLocation.state}
                          onChange={(e) => setEditLocation({ ...editLocation, state: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          placeholder="IL"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                        <input
                          type="text"
                          value={editLocation.zip}
                          onChange={(e) => setEditLocation({ ...editLocation, zip: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          placeholder="62701"
                        />
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setRunStatus('');
                        // Always save locally first
                        localStorage.setItem('vendlocate_saved_location', JSON.stringify(editLocation));
                        try {
                          await apiCall('/user-location', {
                            method: 'POST',
                            body: JSON.stringify({
                              location: {
                                address: editLocation.address,
                                city: editLocation.city,
                                state: editLocation.state,
                                zipCode: editLocation.zip,
                              },
                              preferredRadius: currentRadiusMiles,
                            }),
                          });
                          setShowLocationEdit(false);
                          setRunStatus('Location saved to your account.');
                        } catch (err: any) {
                          // Saved locally even if server call fails
                          setShowLocationEdit(false);
                          if (isAuthenticated) {
                            setRunStatus('Location saved. Server sync will retry on next save.');
                          } else {
                            setRunStatus('Location saved locally. Log in to sync to your account.');
                          }
                        }
                      }}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Save Location
                    </button>
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                      Warning: Once you click <strong>Run</strong>, this location will be locked and cannot be changed without paying $97.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            {runStatus && (
              <div className={`rounded-lg p-4 mb-6 ${runStatus.includes('failed') || runStatus.includes('error') || runStatus.includes('Make sure') ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                {runStatus}
              </div>
            )}

            {/* Terminal Output */}
            {showTerminal && terminalLines.length > 0 && (
              <div className="mb-6 bg-gray-900 rounded-lg shadow-sm border border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-400 text-xs ml-2 font-mono">VendLocate Engine — Terminal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRunning && <span className="text-green-400 text-xs animate-pulse">● Running</span>}
                    {!isRunning && terminalLines.some(l => l.includes('ENGINE FINISHED')) && (
                      <span className="text-green-400 text-xs">✓ Complete</span>
                    )}
                    <button
                      onClick={() => setShowTerminal(false)}
                      className="text-gray-400 hover:text-white text-xs ml-2"
                    >
                      Hide
                    </button>
                  </div>
                </div>
                <div className="p-4 max-h-80 overflow-y-auto font-mono text-sm">
                  {terminalLines.map((line, i) => (
                    <div key={i} className={`py-0.5 ${
                      line.includes('===') ? 'text-yellow-400 font-bold' :
                      line.includes('---') ? 'text-cyan-400 font-bold mt-2' :
                      line.includes('Found') || line.includes('sent') || line.includes('Synced') ? 'text-green-400' :
                      line.includes('Skipping') || line.includes('No email') ? 'text-amber-400' :
                      line.includes('Error') || line.includes('failed') ? 'text-red-400' :
                      'text-gray-300'
                    }`}>
                      {line}
                    </div>
                  ))}
                  {isRunning && (
                    <div className="text-green-400 animate-pulse mt-1">█</div>
                  )}
                </div>
              </div>
            )}
            {!showTerminal && isRunning && (
              <button
                onClick={() => setShowTerminal(true)}
                className="mb-6 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Show Terminal Output
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Leads"
                value={stats.total}
                icon={<TrendingUp className="w-8 h-8 text-blue-600" />}
                color="blue"
              />
              <StatCard
                title="Emails Sent"
                value={stats.emailsSent}
                icon={<Send className="w-8 h-8 text-indigo-600" />}
                color="indigo"
              />
              <StatCard
                title="Responded"
                value={stats.responded}
                icon={<CheckCircle className="w-8 h-8 text-green-600" />}
                color="green"
              />
              <StatCard
                title="Pending"
                value={stats.pending}
                icon={<Clock className="w-8 h-8 text-yellow-600" />}
                color="yellow"
              />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="all">All Locations</option>
                      {userLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.label || `${loc.city}, ${loc.state}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search businesses..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="all">All Leads</option>
                      <option value="responded">Responded</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="date">Date Contacted</option>
                    <option value="name">Business Name</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Follow-up
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{lead.businessName}</div>
                            <div className="text-sm text-gray-500">{lead.businessType}</div>
                            <div className="text-sm text-gray-500">
                              {lead.city}, {lead.state} • {lead.distanceFromClient} mi
                            </div>
                            {!lead.hasWebsite && (
                              <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-1">
                                <Globe className="w-3 h-3" />
                                No website
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {lead.responded ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-4 h-4" />
                              Responded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                              <Clock className="w-4 h-4" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {lead.emailSent && (
                              <div className="flex items-center gap-1 text-gray-600 mb-1">
                                <Mail className="w-4 h-4" />
                                {lead.emailSentDate && new Date(lead.emailSentDate).toLocaleDateString()}
                              </div>
                            )}
                            <div className="text-xs text-gray-500">{lead.email}</div>
                            <div className="text-xs text-gray-500">{lead.phone}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {lead.followUpSent ? (
                            <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                              <AlertCircle className="w-4 h-4" />
                              Sent {lead.followUpDate && new Date(lead.followUpDate).toLocaleDateString()}
                            </span>
                          ) : lead.emailSent && !lead.responded ? (
                            <span className="text-sm text-gray-500">Scheduled</span>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-xs truncate">{lead.notes}</div>
                          {lead.hasWebsite && lead.websiteUrl && (
                            <a
                              href={lead.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                            >
                              <Globe className="w-3 h-3" />
                              Visit website
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredLeads.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No live leads yet</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Once your purchase is complete and the discovery engine runs, qualified businesses will
                  appear here with contact details, outreach status, and follow-up history.
                </p>
              </div>
            )}
          </>
        )}

        {/* Search Settings Tab */}
        {currentTab === 'filters' && (
          <div className="space-y-6">
            {/* Current Radius & Upgrade */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Search Radius</h2>
                  <p className="text-gray-600 mt-1">
                    Your current search radius determines how far from your location the engine scans for businesses.
                  </p>
                </div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Current radius</p>
                  <p className="text-2xl font-bold text-indigo-600">{currentRadiusMiles} miles</p>
                  <p className="text-xs text-gray-500 mt-1">Centered on {editLocation.city || 'your location'}, {editLocation.state || ''}</p>
                </div>
                {!isLocationLocked && (
                  <button
                    onClick={() => navigate('/pricing?action=upgrade-radius')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm"
                  >
                    Upgrade Radius
                  </button>
                )}
                {isLocationLocked && (
                  <span className="text-sm text-gray-500 italic">Location locked — purchase a new location to change radius</span>
                )}
              </div>
              {!showRadiusUpgrade && !isLocationLocked && (
                <button
                  onClick={() => setShowRadiusUpgrade(!showRadiusUpgrade)}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  See upgrade pricing
                </button>
              )}
              {showRadiusUpgrade && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Pay the difference to upgrade your radius. Your current {currentRadiusMiles}-mile radius is replaced.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { miles: 5, price: 97 },
                      { miles: 10, price: 197 },
                      { miles: 15, price: 297 },
                      { miles: 20, price: 397 },
                      { miles: 30, price: 497 },
                    ].filter(r => r.miles > currentRadiusMiles).map(r => {
                      const currentPrice = [
                        { miles: 5, price: 97 },
                        { miles: 10, price: 197 },
                        { miles: 15, price: 297 },
                        { miles: 20, price: 397 },
                        { miles: 30, price: 497 },
                      ].find(c => c.miles === currentRadiusMiles)?.price || 0;
                      const diff = r.price - currentPrice;
                      return (
                        <div key={r.miles} className="border border-gray-200 rounded-lg p-3 text-center">
                          <p className="font-bold text-gray-900">{r.miles} mi</p>
                          <p className="text-sm text-indigo-600 font-semibold">${diff}</p>
                          <p className="text-xs text-gray-500">upgrade fee</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Search Settings</h2>
                <p className="text-gray-600 mt-1">
                  Configure which business types the discovery engine searches for. Changes take effect on the next scan.
                </p>
              </div>

              {/* Standard Business Types */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Standard Business Types</h3>
                  <p className="text-sm text-indigo-600 font-medium">
                    {businessTypes.filter(bt => bt.enabled && !bt.isPremium).length} of {maxSelections} used
                    {purchaseInfo.extraSelections > 0 && (
                      <span className="text-gray-500 font-normal"> ({5} base + {purchaseInfo.extraSelections} extra)</span>
                    )}
                  </p>
                </div>
                <div className="space-y-3">
                  {businessTypes.filter(bt => !bt.isPremium).map((bt) => {
                    const standardSelected = businessTypes.filter(b => b.enabled && !b.isPremium).length;
                    const atCap = !bt.enabled && standardSelected >= maxSelections;
                    return (
                      <div key={bt.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{bt.name}</span>
                          <label className={`flex items-center gap-2 ${atCap ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={bt.enabled}
                              disabled={atCap}
                              onChange={(e) => updateBusinessType(bt.id, { enabled: e.target.checked })}
                              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">Include</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {businessTypes.filter(bt => bt.enabled && !bt.isPremium).length >= maxSelections && (
                  <p className="text-xs text-amber-600 mt-2">Standard slots full. Add extra selections below.</p>
                )}
              </div>

              {/* Premium Business Types */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Premium Add-ons</h3>
                <p className="text-sm text-gray-500 mb-3">These types cost extra to search for. They don't count against your standard limit.</p>
                <div className="space-y-3">
                  {businessTypes.filter(bt => bt.isPremium).map((bt) => (
                    <div key={bt.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{bt.name}</span>
                          <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Premium · ${bt.premiumPrice}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {bt.enabled ? (
                            <span className="text-sm text-green-600 font-medium">✓ Included</span>
                          ) : (
                            <Link
                              to="/pricing?action=add-selections"
                              className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700"
                            >
                              Add · ${bt.premiumPrice}
                            </Link>
                          )}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bt.enabled}
                              onChange={(e) => updateBusinessType(bt.id, { enabled: e.target.checked })}
                              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                            />
                            <span className="text-sm text-gray-700">Include</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purchase More Selections */}
              <div className="border-t pt-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Need More Selections?</h3>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Extra Standard Selections</p>
                      <p className="text-sm text-gray-500">$29 each — add slots for more standard types</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-gray-300 rounded-lg">
                        <button
                          onClick={() => setBuyExtraSelections(Math.max(0, buyExtraSelections - 1))}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100"
                        >−</button>
                        <span className="px-4 py-1.5 font-medium text-gray-900 min-w-[2rem] text-center">{buyExtraSelections}</span>
                        <button
                          onClick={() => setBuyExtraSelections(buyExtraSelections + 1)}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100"
                        >+</button>
                      </div>
                      <span className="text-sm font-semibold text-indigo-600 w-16 text-right">
                        ${buyExtraSelections * 29}
                      </span>
                    </div>
                  </div>
                </div>

                {buyExtraSelections > 0 && (
                  <>
                    <label className="mt-4 flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={buyTermsAccepted}
                        onChange={(e) => setBuyTermsAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">
                        I agree to the{' '}
                        <button type="button" onClick={() => setShowTerms(true)} className="text-indigo-600 underline hover:text-indigo-800 font-medium">
                          Terms and Conditions
                        </button>
                      </span>
                    </label>
                    <button
                      onClick={handleInlinePurchase}
                      disabled={isBuying || !buyTermsAccepted}
                      className="mt-2 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isBuying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Purchase ${buyExtraSelections} Extra Selection${buyExtraSelections > 1 ? 's' : ''} — $${buyExtraSelections * 29}`}
                    </button>
                  </>
                )}

                {buyError && (
                  <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{buyError}</div>
                )}
                {buySuccess && (
                  <div className="mt-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{buySuccess}</div>
                )}
                <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
              </div>

              <button
                onClick={saveSearchSettings}
                disabled={isSavingSearchSettings}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {isSavingSearchSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Search Settings
              </button>
            </div>
          </div>
        )}

        {/* No Websites Tab */}
        {currentTab === 'noWebsites' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-3">Why No-Website Businesses Are Gold Mines</h2>
                  <p className="text-purple-100 mb-4 text-lg">
                    These locations are hidden gems that most vending operators overlook. Here's why they're valuable:
                  </p>
                  <ul className="space-y-2 text-purple-100">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">Less Competition:</strong> Without an online presence, these businesses are harder to find. Your competitors likely haven't contacted them yet.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">In-Person Advantage:</strong> Visit them directly. Face-to-face conversations build trust faster than cold emails ever could.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">Decision Makers On-Site:</strong> Small businesses without websites often have owners working on-location. You can pitch directly to the person with authority.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white">Proven High Foot Traffic:</strong> Many of these locations still rank highly because they have excellent foot traffic and accessibility.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* No Website Leads Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  No-Website Locations ({noWebsiteLeads.length})
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Perfect candidates for in-person visits
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {noWebsiteLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{lead.businessName}</div>
                            <div className="text-sm text-gray-500">{lead.businessType}</div>
                            <div className="text-sm text-gray-500">
                              {lead.address}, {lead.city}, {lead.state} {lead.zipCode}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="text-gray-600">{lead.email}</div>
                            <div className="text-gray-600">{lead.phone}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {lead.distanceFromClient} miles
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">{lead.notes}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {noWebsiteLeads.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {leads.length === 0
                    ? 'No live leads yet. No-website opportunities will appear here after the first scan runs.'
                    : 'All businesses in your current database have websites.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Email History Tab */}
        {currentTab === 'emailHistory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Email History</h2>
              <p className="text-gray-600 mb-6">
                Every email sent through the system is logged here. The unique constraint on
                (recipient + type + subject) prevents any person from being emailed twice for the same purpose.
              </p>

              {emailHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No emails sent yet</h3>
                  <p className="text-gray-500">
                    Email history will appear here after the outreach engine runs and sends emails.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipient
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sent At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {emailHistory.map((email: any) => (
                        <tr key={email.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{email.recipient}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              email.email_type === 'outreach_initial'
                                ? 'bg-blue-100 text-blue-800'
                                : email.email_type === 'outreach_followup'
                                ? 'bg-purple-100 text-purple-800'
                                : email.email_type === 'verification'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {email.email_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 max-w-xs truncate">{email.subject}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-sm ${
                              email.status === 'sent'
                                ? 'text-green-600'
                                : email.status === 'failed'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }`}>
                              {email.status === 'sent' && <CheckCircle className="w-4 h-4" />}
                              {email.status === 'failed' && <AlertCircle className="w-4 h-4" />}
                              {email.status === 'queued' && <Clock className="w-4 h-4" />}
                              {email.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {email.sent_at && new Date(email.sent_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Database Tab */}
        {currentTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Outreach Settings</h2>
              <p className="text-gray-600 mb-6">
                Save the contact details used by the outreach engine. Leads and sent-email history sync
                automatically when the discovery program runs.
              </p>

              {settingsStatus && (
                <div className="mb-6 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-lg">
                  {settingsStatus}
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sending Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={settings.outreachEmail}
                      onChange={(e) => setSettings({ ...settings, outreachEmail: e.target.value })}
                      placeholder="you@gmail.com"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gmail App Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={settings.smtpAppPassword}
                      onChange={(e) => setSettings({ ...settings, smtpAppPassword: e.target.value })}
                      placeholder="16-character app password"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-900 font-medium mb-2">What is a Gmail App Password?</p>
                <p className="text-sm text-amber-800 mb-3">
                  A Gmail App Password is a <strong>16-character one-time code</strong> generated by Google that lets Vendlocate send emails from your Gmail address. It is <strong>NOT your Gmail password</strong> — you never share your real password.
                </p>
                <p className="text-sm font-medium text-amber-900 mb-1">How to generate one:</p>
                <ol className="list-decimal list-inside text-sm text-amber-800 space-y-1">
                  <li>Go to your <a href="https://myaccount.google.com/security" target="_blank" className="underline font-medium">Google Account Security settings</a></li>
                  <li>Turn on <strong>2-Step Verification</strong> if not already enabled</li>
                  <li>Search for <strong>"App passwords"</strong> in the Google Account search bar</li>
                  <li>Select <strong>Mail</strong> as the app and <strong>Windows Computer</strong> as the device</li>
                  <li>Copy the generated 16-character code and paste it here</li>
                </ol>
                <p className="text-xs text-amber-700 mt-2">
                  This password is stored securely and only used to send outreach emails through your Gmail account.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name (used in emails)</label>
                  <input
                    type="text"
                    value={settings.senderName}
                    onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                    placeholder="Evan"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">This name appears as the sender in all outreach emails</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Template</label>
                <p className="text-xs text-gray-500 mb-2">
                  Edit the email sent to every business. Use {'{business_name}'} where the business name should appear.
                </p>
                <textarea
                  value={settings.emailTemplate || `Hi {business_name} Team,\n\nI run a small vending service that installs and maintains modern smart vending machines at NO COST to your business.\n\nWe handle installation, restocking, repairs, and maintenance.\n\nIf you already have vending machines, we can replace them with newer, more reliable smart machines.\n\nWould you be open to a quick conversation?\n\nBest,\n${settings.senderName || 'Evan'}`}
                  onChange={(e) => setSettings({ ...settings, emailTemplate: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Preview: The {'{business_name}'} tag gets replaced with each business's actual name when the email is sent.
                </p>
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Preview with a sample business:</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">
                    {(settings.emailTemplate || `Hi {business_name} Team,\n\nI run a small vending service that installs and maintains modern smart vending machines at NO COST to your business.\n\nWe handle installation, restocking, repairs, and maintenance.\n\nIf you already have vending machines, we can replace them with newer, more reliable smart machines.\n\nWould you be open to a quick conversation?\n\nBest,\n${settings.senderName || 'Evan'}`).replace('{business_name}', 'Sunshine Laundromat')}
                  </p>
                </div>
              </div>

              <button
                onClick={saveOutreachSettings}
                disabled={isSavingSettings}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Settings
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function estimateProfitScore(name: string, businessType: string): number {
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

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}
