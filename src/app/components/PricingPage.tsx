import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { MapPin, CheckCircle, Star, Lock, CreditCard, ArrowLeft, Loader2, Plus, Minus } from 'lucide-react';
import { apiCall, supabase } from '../utils/supabase';
import { ALL_BUSINESS_TYPES } from '../utils/businessTypes';
import TermsModal from './TermsModal';

const BUSINESS_TYPES = ALL_BUSINESS_TYPES;
const RADIUS_OPTIONS = [
  { miles: 5, price: 97, label: '5 miles', popular: false },
  { miles: 10, price: 197, label: '10 miles', popular: true },
  { miles: 15, price: 297, label: '15 miles' },
  { miles: 20, price: 397, label: '20 miles' },
  { miles: 30, price: 497, label: '30 miles' },
];
const EXTRA_SELECTION_PRICE = 29;

type Step = 'location' | 'radius' | 'types' | 'payment';
interface UserLocation { address: string; city: string; state: string; zipCode: string; }

export default function PricingPage() {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Pricing — VendLocate Pro'; }, []);
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [selectedRadius, setSelectedRadius] = useState(10);
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([]);
  const [extraSelections, setExtraSelections] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [locationData, setLocationData] = useState<UserLocation>({
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const cardContainerRef = useRef(null);
  const stripeCardRef = useRef(null);
  const stripeInstanceRef = useRef(null);

  const isTestUser = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
      return u.email === 'evanbaker127@gmail.com';
    } catch { return false; }
  })();

  const [isFirstPurchase, setIsFirstPurchase] = useState(true);
  const [extraLocationMode, setExtraLocationMode] = useState(false);
  const [upgradeRadiusMode, setUpgradeRadiusMode] = useState(false);
  const [addSelectionsMode, setAddSelectionsMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Always load saved location
    const savedLocation = localStorage.getItem('vendlocate_saved_location');
    if (savedLocation) {
      setLocationData(JSON.parse(savedLocation));
    }

    // Always load current radius from purchase
    const currentUser = localStorage.getItem('vendlocate_current_user');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
      const userPurchase = purchases.find((p: any) => p.userId === user.id);
      if (userPurchase?.radius) {
        setSelectedRadius(userPurchase.radius);
      }
      if (userPurchase?.location) {
        setLocationData(userPurchase.location);
      }
    }

    if (params.get('action') === 'new-location') {
      setExtraLocationMode(true);
      setIsLoading(false);
      return;
    }
    if (params.get('action') === 'upgrade-radius') {
      setUpgradeRadiusMode(true);
      setCurrentStep('radius');
      setIsLoading(false);
      return;
    }
    if (params.get('action') === 'add-selections') {
      setAddSelectionsMode(true);
      // Pre-populate from existing purchase
      const user = JSON.parse(currentUser);
      const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
      const userPurchase = purchases.find((p: any) => p.userId === user.id);
      if (userPurchase) {
        setSelectedBusinessTypes(userPurchase.businessTypes || []);
        setExtraSelections(userPurchase.extraSelections || 0);
      }
      setIsLoading(false);
      return;
    }

    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Load Stripe config
    fetch('/api/stripe-config')
      .then(r => r.json())
      .then(config => {
        if (config.publishableKey) {
          setStripePublishableKey(config.publishableKey);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pricing...</p>
        </div>
      </div>
    );
  }

  const basePrice = selectedRadius === 0 ? 0 : RADIUS_OPTIONS.find((r) => r.miles === selectedRadius)?.price || 197;
  const premiumTypesPrice = selectedBusinessTypes
    .filter((id) => BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium)
    .reduce((sum, id) => sum + (BUSINESS_TYPES.find((bt) => bt.id === id)?.premiumPrice || 0), 0);
  const extraSelectionsPrice = extraSelections * EXTRA_SELECTION_PRICE;
  const totalPrice = basePrice + premiumTypesPrice + extraSelectionsPrice;

  const freeSelections = 5;
  const totalAvailableSelections = freeSelections + extraSelections;
  const premiumSelected = selectedBusinessTypes.filter((id) =>
    BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium
  ).length;
  const standardSelected = selectedBusinessTypes.length - premiumSelected;

  // Mount Stripe Card Element once when we reach the payment step
  useEffect(() => {
    if (currentStep !== 'payment') return;
    if (!stripePublishableKey) return;
    if (isTestUser) return; // test user doesn't need Stripe Elements
    if (stripeCardRef.current) return;

    async function init() {
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(stripePublishableKey);
      if (!stripe || stripeCardRef.current) return;
      stripeInstanceRef.current = stripe;
      const elements = stripe.elements();
      const style = {
        base: {
          fontSize: '16px',
          color: '#374151',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          '::placeholder': { color: '#9CA3AF' },
        },
        invalid: { color: '#DC2626' },
      };
      const card = elements.create('card', { style, hidePostalCode: true });
      if (cardContainerRef.current) {
        card.mount(cardContainerRef.current);
        stripeCardRef.current = card;
        setStripeLoaded(true);
      }
    }

    init();

    return () => {
      if (stripeCardRef.current) {
        try { stripeCardRef.current.destroy(); } catch {}
        stripeCardRef.current = null;
        stripeInstanceRef.current = null;
        setStripeLoaded(false);
      }
    };
  }, [currentStep, stripePublishableKey]);

  const handleBusinessTypeToggle = (typeId: string) => {
    const type = BUSINESS_TYPES.find((bt) => bt.id === typeId);
    if (!type) return;

    if (selectedBusinessTypes.includes(typeId)) {
      setSelectedBusinessTypes(selectedBusinessTypes.filter((id) => id !== typeId));
    } else {
      const currentStandardSelected = selectedBusinessTypes.filter(
        (id) => !BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium
      ).length;

      if (type.isPremium || currentStandardSelected < totalAvailableSelections) {
        setSelectedBusinessTypes([...selectedBusinessTypes, typeId]);
      }
    }
  };

  const getAuthedFetchHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      // Fallback to localStorage user
      const saved = localStorage.getItem('vendlocate_current_user');
      return saved ? {} : {};
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const handleTestBypass = async () => {
    setPaymentError('');
    setIsProcessing(true);

    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
    const headers = await getAuthedFetchHeaders();
    if (!termsAccepted) {
      setPaymentError('You must agree to the Terms of Service and No-Refund Policy to continue.');
      setIsProcessing(false);
      return;
    }
    const payload = {
      radius: selectedRadius,
      businessTypes: selectedBusinessTypes,
      extraSelections,
      premiumTypes: selectedBusinessTypes.filter((id) => BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium),
      totalPrice,
      location: locationData,
      acceptedTerms: true,
    };

    try {
      const createResp = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const createData = await createResp.json();
      if (!createResp.ok) throw new Error(createData.error || 'Failed to create payment');
      if (!createData.testBypass) throw new Error('Expected test bypass but got normal payment flow');
      savePurchaseLocally(currentUser, createData.purchaseId);
      setIsProcessing(false);
      navigate('/dashboard');
    } catch (err: any) {
      setPaymentError(err.message || 'Something went wrong');
      setIsProcessing(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setIsProcessing(true);

    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
    const headers = await getAuthedFetchHeaders();

    if (!termsAccepted) {
      setPaymentError('You must agree to the Terms of Service and No-Refund Policy to continue.');
      setIsProcessing(false);
      return;
    }
    // Build the payload
    const payload = {
      radius: selectedRadius,
      businessTypes: selectedBusinessTypes,
      extraSelections,
      premiumTypes: selectedBusinessTypes.filter((id) => BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium),
      totalPrice,
      location: locationData,
      acceptedTerms: true,
    };

    try {
      // Step 1: Create payment intent on Vercel
      const createResp = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const createData = await createResp.json();

      if (!createResp.ok) {
        throw new Error(createData.error || 'Failed to create payment');
      }

      // Step 2: If test bypass, just save locally and go
      if (createData.testBypass) {
        savePurchaseLocally(currentUser, createData.purchaseId);
        setIsProcessing(false);
        navigate('/dashboard');
        return;
      }

      // Step 3: Confirm payment with Stripe
      if (!stripeCardRef.current || !createData.clientSecret) {
        throw new Error('Payment method not available. Please try again.');
      }

      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = stripeInstanceRef.current || await loadStripe(stripePublishableKey);
      if (!stripe) throw new Error('Failed to load payment processor');

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        createData.clientSecret,
        { payment_method: { card: stripeCardRef.current } }
      );

      if (confirmError) {
        throw new Error(confirmError.message || 'Card declined');
      }

      if (paymentIntent?.status !== 'succeeded') {
        throw new Error('Payment was not completed');
      }

      // Step 4: Confirm purchase on server
      const confirmResp = await fetch('/api/confirm-purchase', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          purchaseId: createData.purchaseId,
          paymentIntentId: paymentIntent.id,
          location: locationData,
          radius: selectedRadius,
        }),
      });

      if (!confirmResp.ok) {
        const confirmErr = await confirmResp.json();
        throw new Error(confirmErr.error || 'Failed to confirm purchase');
      }

      savePurchaseLocally(currentUser, createData.purchaseId);
      setIsProcessing(false);
      navigate('/dashboard');
    } catch (err: any) {
      setPaymentError(err.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const savePurchaseLocally = (user, purchaseId) => {
    const premiumTypeIds = selectedBusinessTypes.filter((id) =>
      BUSINESS_TYPES.find((bt) => bt.id === id)?.isPremium
    );
    const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
    purchases.push({
      id: purchaseId || Date.now().toString(),
      userId: user.id,
      email: user.email,
      radius: selectedRadius,
      businessTypes: selectedBusinessTypes,
      extraSelections,
      premiumTypes: premiumTypeIds,
      location: locationData,
      totalPrice,
      purchaseDate: new Date().toISOString(),
    });
    localStorage.setItem('vendlocate_purchases', JSON.stringify(purchases));
    localStorage.setItem('vendlocate_saved_location', JSON.stringify(locationData));

    // Save search settings
    const allTypes = BUSINESS_TYPES.map(bt => ({
      id: bt.id,
      name: bt.name,
      requiredKeywords: [...(bt.requiredKeywords || [])],
      optionalKeywords: [...(bt.optionalKeywords || [])],
      enabled: selectedBusinessTypes.includes(bt.id),
    }));
    const existingSearchSettings = JSON.parse(localStorage.getItem('vendlocate_search_settings') || '{}');
    localStorage.setItem('vendlocate_search_settings', JSON.stringify({
      ...existingSearchSettings,
      enabledBusinessTypes: allTypes.filter(t => t.enabled).map(t => t.name),
      businessTypes: allTypes,
    }));
  };

  // Location Step
  if (currentStep === 'location') {
    return (
      <>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {extraLocationMode ? 'Add New Location' : 'Your Location'}
              </h1>
              <p className="text-gray-600">
                {extraLocationMode
                  ? 'Enter your new search location. Your current locked location stays active alongside this one.'
                  : isFirstPurchase
                  ? "Enter your location once. We'll remember it for all future searches."
                  : 'Update your location anytime. This affects your search center point.'}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCurrentStep(extraLocationMode ? 'payment' : 'radius');
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                <input
                  type="text"
                  required
                  value={locationData.address}
                  onChange={(e) => setLocationData({ ...locationData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    required
                    value={locationData.city}
                    onChange={(e) => setLocationData({ ...locationData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Springfield"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    required
                    value={locationData.state}
                    onChange={(e) => setLocationData({ ...locationData, state: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="IL"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                  <input
                    type="text"
                    required
                    value={locationData.zipCode}
                    onChange={(e) => setLocationData({ ...locationData, zipCode: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="62701"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  {extraLocationMode
                    ? 'This adds a new search location for $97. Your existing locked location remains unchanged. Leads from both locations will appear in your dashboard.'
                    : 'Your location is your search center point. All searches are measured from this address. You can update it anytime.'}
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                {extraLocationMode ? 'Continue to Payment — $97' : 'Continue to Search Distance'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
    );
  }

  // Radius Selection Step
  if (currentStep === 'radius') {
    // Compute the highest radius the user has already paid for
    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
    const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
    const userPurchase = purchases.find((p: any) => p.userId === currentUser.id);
    const paidRadiusMiles = userPurchase?.radius || 0;
    const paidPrice = RADIUS_OPTIONS.find(r => r.miles === paidRadiusMiles)?.price || 0;

    return (
      <>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setCurrentStep('location')}
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Location
          </button>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {upgradeRadiusMode ? 'Upgrade Your Search Distance' : 'Choose Your Search Distance'}
            </h1>
            <p className="text-xl text-gray-600">
              {upgradeRadiusMode
                ? `You've paid for ${paidRadiusMiles} miles. Upgrade to search farther.`
                : `Pay more to unlock searches farther from ${locationData.city}, ${locationData.state}`}
            </p>
            {upgradeRadiusMode && paidRadiusMiles > 0 && (
              <p className="text-sm text-green-600 mt-2 font-medium">
                Tiers at or below {paidRadiusMiles} miles are free — you already paid for them.
              </p>
            )}
            {!upgradeRadiusMode && (
              <p className="text-sm text-gray-600 mt-2">
                Larger search areas cost more because the program scans more businesses and finds more leads for your account.
              </p>
            )}
          </div>

              <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
            {RADIUS_OPTIONS.map((option) => {
              const isCustom = option.miles === 0;
              const isAlreadyPaid = upgradeRadiusMode && option.miles <= paidRadiusMiles;
              const upgradeCost = upgradeRadiusMode
                ? Math.max(0, option.price - paidPrice)
                : option.price;

              return (
                <button
                  key={option.miles}
                  onClick={() => setSelectedRadius(option.miles)}
                  className={`relative bg-white rounded-xl shadow-md p-6 text-center transition-all hover:shadow-lg ${
                    isCustom
                      ? 'border-2 border-dashed border-purple-400 hover:border-purple-600'
                      : selectedRadius === option.miles
                      ? 'ring-4 ring-indigo-600 border-2 border-indigo-600'
                      : isAlreadyPaid
                      ? 'border-2 border-green-300 bg-green-50'
                      : 'border-2 border-gray-200'
                  }`}
                >
                  {option.popular && !isAlreadyPaid && !isCustom && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      POPULAR
                    </div>
                  )}
                  {isAlreadyPaid && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      FREE
                    </div>
                  )}
                  {isCustom && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      CUSTOM
                    </div>
                  )}
                  <MapPin className={`w-10 h-10 mx-auto mb-3 ${isCustom ? 'text-purple-600' : isAlreadyPaid ? 'text-green-600' : 'text-indigo-600'}`} />
                  {isCustom ? (
                    <div className="text-3xl font-bold text-purple-600 mb-1">?</div>
                  ) : isAlreadyPaid ? (
                    <>
                      <div className="text-3xl font-bold text-green-600 mb-1">Free</div>
                      <div className="text-xs text-green-700 mb-1 line-through">${option.price}</div>
                    </>
                  ) : (
                    <div className="text-3xl font-bold text-gray-900 mb-1">${upgradeRadiusMode ? upgradeCost : option.price}</div>
                  )}
                  <div className="text-lg font-semibold text-gray-700 mb-1">{option.label}</div>
                  <div className="text-xs text-gray-500 mb-2">{isCustom ? 'Contact for pricing' : option.description}</div>
                  {isCustom && selectedRadius === option.miles && (
                    <div className="text-xs text-purple-700 mt-2 font-medium">
                      Contact evanbaker127@gmail.com for pricing
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={async () => {
              if (selectedRadius === 0) return;
              if (upgradeRadiusMode) {
                // If the selected radius is one they already have, just set it — no payment
                if (selectedRadius <= paidRadiusMiles) {
                  try {
                    await apiCall('/user-location', {
                      method: 'POST',
                      body: JSON.stringify({
                        location: locationData,
                        preferredRadius: selectedRadius,
                      }),
                    });
                  } catch {}
                  // Update local purchase record
                  const allPurchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                  const idx = allPurchases.findIndex((p: any) => p.userId === currentUser.id);
                  if (idx >= 0) {
                    allPurchases[idx].radius = selectedRadius;
                    localStorage.setItem('vendlocate_purchases', JSON.stringify(allPurchases));
                  }
                  navigate('/dashboard');
                  return;
                }
                setCurrentStep('payment');
              } else {
                setCurrentStep('businesses');
              }
            }}
            className={`w-full py-4 rounded-lg text-lg font-semibold transition-colors ${
              selectedRadius === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {selectedRadius === 0
              ? 'Contact evanbaker127@gmail.com for pricing'
              : upgradeRadiusMode
                ? (selectedRadius <= paidRadiusMiles ? 'Set Radius (Free)' : 'Set Radius')
                : 'Continue to Business Selection'}
          </button>
        </div>
      </div>
    </>
    );
  }

  // Business Types Step
  if (currentStep === 'businesses') {
    const standardTypes = BUSINESS_TYPES.filter((bt) => !bt.isPremium);
    const premiumTypes = BUSINESS_TYPES.filter((bt) => bt.isPremium);

    return (
      <>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setCurrentStep('radius')}
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Distance Selection
          </button>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Business Types</h1>
            <p className="text-xl text-gray-600 mb-2">
              Select up to {totalAvailableSelections} business types to target
            </p>
            <p className="text-sm text-gray-500">
              ({standardSelected}/{totalAvailableSelections} standard selections used)
            </p>
            <p className="text-sm text-indigo-600 mt-2 font-medium">
              You can always add more business types later for $29 each — premium types cost $49.
            </p>

          </div>

          {/* Extra Selections */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Need More Selections?</h3>
                <p className="text-sm text-gray-600">
                  Add extra business type slots for ${EXTRA_SELECTION_PRICE} each
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setExtraSelections(Math.max(0, extraSelections - 1))}
                  disabled={extraSelections === 0}
                  className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-5 h-5 text-gray-600" />
                </button>
                <div className="text-2xl font-bold text-gray-900 w-12 text-center">{extraSelections}</div>
                <button
                  onClick={() => setExtraSelections(extraSelections + 1)}
                  className="w-10 h-10 rounded-lg border-2 border-indigo-600 flex items-center justify-center hover:bg-indigo-50"
                >
                  <Plus className="w-5 h-5 text-indigo-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Standard Business Types */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Standard Locations</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {standardTypes.map((type) => {
                const isSelected = selectedBusinessTypes.includes(type.id);
                const canSelect = isSelected || standardSelected < totalAvailableSelections;

                return (
                  <button
                    key={type.id}
                    onClick={() => handleBusinessTypeToggle(type.id)}
                    disabled={!canSelect}
                    className={`relative bg-white rounded-lg shadow-md p-4 text-left transition-all ${
                      isSelected
                        ? 'ring-4 ring-indigo-600 border-2 border-indigo-600'
                        : canSelect
                        ? 'border-2 border-gray-200 hover:border-indigo-300'
                        : 'border-2 border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{type.name}</h4>
                      {isSelected && <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-600">
                      <strong>Keywords:</strong> {type.requiredKeywords.join(', ')}
                    </div>
                    {!canSelect && !isSelected && (
                      <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                        <Lock className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Premium Business Types */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 mb-4 text-white">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 flex-shrink-0">
                  <Star className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Premium Add-ons</h3>
                  <p className="text-amber-50 mb-3">
                    These business types require specialized search queries and cost extra to run.
                    Laundromats, warehouses, and senior communities each have dedicated data sources.
                  </p>
                  <ul className="space-y-1 text-amber-50">
                    <li>• Requires additional API lookups during scan</li>
                    <li>• Each type has its own data pipeline (Overture + Google)</li>
                    <li>• Only pay for what you search</li>
                    <li>• No recurring fees — one-time cost per scan</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {premiumTypes.map((type) => {
                const isSelected = selectedBusinessTypes.includes(type.id);

                return (
                  <button
                    key={type.id}
                    onClick={() => handleBusinessTypeToggle(type.id)}
                    className={`relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg shadow-md p-6 text-left transition-all border-2 ${
                      isSelected
                        ? 'ring-4 ring-amber-500 border-amber-500'
                        : 'border-amber-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-600" />
                        <h4 className="font-bold text-gray-900 text-lg">{type.name}</h4>
                      </div>
                      {isSelected && <CheckCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />}
                    </div>
                    <div className="text-sm text-gray-700 mb-3">
                      <strong>Keywords:</strong> {type.requiredKeywords.join(', ')}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-amber-200">
                      <span className="text-xs font-semibold text-amber-800">PREMIUM ADD-ON</span>
                      <span className="text-xl font-bold text-amber-600">+${type.premiumPrice}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-gray-700">
                <span>{selectedRadius} mile search radius</span>
                <span>${basePrice}</span>
              </div>
              {extraSelections > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>{extraSelections} extra selection(s)</span>
                  <span>${extraSelectionsPrice}</span>
                </div>
              )}
              {premiumTypesPrice > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>{premiumSelected} premium location type(s)</span>
                  <span>${premiumTypesPrice}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between text-xl font-bold text-gray-900">
                  <span>Total</span>
                  <span>${totalPrice}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setCurrentStep('payment')}
            disabled={selectedBusinessTypes.length === 0}
            className="w-full bg-indigo-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </>
    );
  }

  // Payment Step
  if (currentStep === 'payment') {
    const backStep = upgradeRadiusMode ? 'radius' : extraLocationMode ? 'location' : 'businesses';
    const backLabel = upgradeRadiusMode ? 'Distance Selection' : extraLocationMode ? 'Location' : 'Business Selection';
    return (
      <>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setCurrentStep(backStep)}
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {backLabel}
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {upgradeRadiusMode ? 'Upgrade Search Radius' : extraLocationMode ? 'Add New Location' : 'Complete Your Purchase'}
              </h1>
              <p className="text-gray-600">Secure checkout - Your information is protected</p>
            </div>

            {/* Order Summary */}
            <div className="bg-indigo-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm mb-4">
                {upgradeRadiusMode ? (() => {
                  try {
                    const newPrice = RADIUS_OPTIONS.find(r => r.miles === selectedRadius)?.price || 197;
                    const purchases = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                    const currentUser = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
                    const userPurchase = purchases.find((p: any) => p.userId === currentUser.id);
                    const currentPaidPrice = userPurchase?.radius
                      ? (RADIUS_OPTIONS.find(r => r.miles === userPurchase.radius)?.price || 0)
                      : 0;
                    const currentMiles = userPurchase?.radius || 0;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Current: {currentMiles} miles (paid ${currentPaidPrice})</span>
                          <span className="font-medium text-gray-500 line-through">${currentPaidPrice}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Upgrade to: {selectedRadius} miles</span>
                          <span className="font-medium">${newPrice}</span>
                        </div>
                      </>
                    );
                  } catch {
                    return (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Upgrade to: {selectedRadius} miles</span>
                      </div>
                    );
                  }
                })() : extraLocationMode ? (
                  <div className="flex justify-between">
                    <span className="text-gray-700">New search location (unlocks editing)</span>
                    <span className="font-medium">$97</span>
                  </div>
                ) : selectedRadius === 0 ? (
                  <>
                <div className="flex justify-between">
                  <span className="text-gray-700">Custom search radius</span>
                  <span className="font-medium text-purple-600">Contact for pricing</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">
                    5 standard location types
                  </span>
                  <span className="font-medium">Included</span>
                </div>
                {extraSelections > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">{extraSelections} extra selection(s)</span>
                    <span className="font-medium">${extraSelectionsPrice}</span>
                  </div>
                )}
                {premiumSelected > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">{premiumSelected} premium location type(s)</span>
                    <span className="font-medium">${premiumTypesPrice}</span>
                  </div>
                )}
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
                  <p className="text-sm text-purple-900 font-medium">Contact evanbaker127@gmail.com for custom pricing</p>
                </div>
                </>
                ) : (
                  <>
                <div className="flex justify-between">
                  <span className="text-gray-700">{selectedRadius} mile search radius</span>
                  <span className="font-medium">${basePrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">
                    5 standard location types
                  </span>
                  <span className="font-medium">Included</span>
                </div>
                {extraSelections > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">{extraSelections} extra selection(s)</span>
                    <span className="font-medium">${extraSelectionsPrice}</span>
                  </div>
                )}
                {premiumSelected > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">{premiumSelected} premium location type(s)</span>
                    <span className="font-medium">${premiumTypesPrice}</span>
                  </div>
                )}
                </>
                )}
              </div>
              <div className="pt-4 border-t border-indigo-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                  <span className="text-3xl font-bold text-indigo-600">
                    ${upgradeRadiusMode ? (() => {
                      try {
                        const newP = RADIUS_OPTIONS.find(r => r.miles === selectedRadius)?.price || 197;
                        const p = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                        const u = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
                        const up = p.find((x: any) => x.userId === u.id);
                        const cp = up?.radius ? (RADIUS_OPTIONS.find(r => r.miles === up.radius)?.price || 0) : 0;
                        return Math.max(0, newP - cp);
                      } catch { return 0; }
                    })() : extraLocationMode ? 97 : totalPrice}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handlePayment} className="space-y-6">
              {paymentError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {paymentError}
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Location</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-700">
                    <strong>Address:</strong> {locationData.address}, {locationData.city}, {locationData.state}{' '}
                    {locationData.zipCode}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('location')}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mt-2"
                  >
                    Change Location
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
                <div className="space-y-4">
                  {isTestUser ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 font-semibold text-lg mb-2">
                        Test Account — Free Access
                      </p>
                      <p className="text-sm text-green-700 mb-4">
                        Your account (evanbaker127@gmail.com) gets free purchases. No card needed.
                      </p>
                      <button
                        type="button"
                        onClick={handleTestBypass}
                        disabled={isProcessing}
                        className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Creating Free Purchase...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Continue for Free
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                        <input
                          type="text"
                          required
                          id="cardholder-name"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Card Details</label>
                        <div
                          ref={cardContainerRef}
                          className="w-full px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent bg-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!isTestUser && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-green-800">
                      <strong>100% Secure Payment</strong> - Your payment information is encrypted and secure. We never
                      store your credit card details.
                    </div>
                  </div>
                </div>
              )}

              {!isTestUser && (
                <button
                  type={selectedRadius === 0 ? 'button' : 'submit'}
                  disabled={isProcessing || selectedRadius === 0 || !termsAccepted}
                  className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {upgradeRadiusMode ? 'Setting Radius...' : 'Processing Payment...'}
                    </>
                  ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        {selectedRadius === 0 ? 'Contact evanbaker127@gmail.com for pricing' : upgradeRadiusMode ? (() => {
                          try {
                            const newP = RADIUS_OPTIONS.find(r => r.miles === selectedRadius)?.price || 197;
                            const p = JSON.parse(localStorage.getItem('vendlocate_purchases') || '[]');
                            const u = JSON.parse(localStorage.getItem('vendlocate_current_user') || '{}');
                            const up = p.find((x: any) => x.userId === u.id);
                            const cp = up?.radius ? (RADIUS_OPTIONS.find(r => r.miles === up.radius)?.price || 0) : 0;
                            return `Set Radius — $${Math.max(0, newP - cp)}`;
                          } catch { return 'Set Radius'; }
                        })() : extraLocationMode ? 'Pay $97' : `Pay $${totalPrice}`}
                      </>
                  )}
                </button>
              )}

              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  I have read and agree to the{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-indigo-600 underline hover:text-indigo-800 font-medium">
                    Terms and Conditions
                  </button>.
                </span>
              </label>
            </form>
          </div>
        </div>
      </div>
    </>
    );
  }

  return null;
}
