import { useEffect } from 'react';
import { Link } from 'react-router';
import { MapPin, Mail, TrendingUp, FileSpreadsheet, Clock, Target } from 'lucide-react';

export default function LandingPage() {
  useEffect(() => { document.title = 'VendLocate Pro — Find Premium Vending Machine Locations'; }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <MapPin className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">VendLocate Pro</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/login"
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="inline-block bg-indigo-100 text-indigo-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
            Start Small. Build a Vending Empire.
          </div>
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Launch Your Vending Machine Empire
          </h2>
          <p className="text-xl text-gray-600 mb-4 max-w-3xl mx-auto">
            Skip months of cold calling and door-to-door hunting. We've already identified hundreds of
            high-traffic businesses in your area that are perfect for vending machines — just waiting for you.
          </p>
          <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto font-medium">
            One location can make you back 5x your investment in the first month. Four locations can
            replace your full-time income. Start your empire today.
          </p>
          <Link
            to="/register"
            className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
          >
            Build Your Empire Now
          </Link>
          <p className="text-sm text-gray-500 mt-3">Create free account to get started — pay only when you're ready to unlock leads</p>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-3xl font-bold mb-4">
              Why Waste Time When We've Already Done the Work?
            </h3>
            <p className="text-lg mb-6 text-indigo-100">
              There are hundreds of businesses near you RIGHT NOW that would be perfect for vending machines.
              We've identified them, researched them, and prepared personalized outreach campaigns for each one.
              One placement can generate $300–$800/month in passive income. Ten placements? You've built yourself
              a real empire.
            </p>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                <div className="text-4xl font-bold mb-2">100+</div>
                <div className="text-indigo-100 text-lg">Pre-Qualified Locations Delivered</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                <div className="text-4xl font-bold mb-2">24/7</div>
                <div className="text-indigo-100 text-lg">Lead Tracking Dashboard</div>
              </div>
            </div>
            <p className="text-md text-indigo-200 mb-6 bg-white/5 backdrop-blur rounded-lg p-3">
              If a business doesn't respond within 48 hours, we automatically send a follow-up email. No extra work needed.
            </p>
            <p className="text-lg font-medium bg-white/10 backdrop-blur rounded-lg p-4">
              Our database contains extensively researched locations with contact information, foot traffic estimates, and ranked viability scores. Access requires a one-time payment to unlock your area's complete lead package.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Everything You Need to Build Your Vending Empire
        </h3>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          From your first machine to your hundredth — we give you the tools to find, secure, and scale locations faster than ever.
        </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<MapPin className="w-12 h-12 text-indigo-600" />}
              title="Location Intelligence"
              description="We analyze businesses near you and identify high-potential vending locations based on foot traffic, business type, and accessibility."
            />
            <FeatureCard
              icon={<Mail className="w-12 h-12 text-indigo-600" />}
              title="Automated Outreach"
              description="Personalized emails sent to every qualified lead automatically. We handle all the initial contact work for you."
            />
            <FeatureCard
              icon={<Clock className="w-12 h-12 text-indigo-600" />}
              title="Smart Follow-ups"
              description="If a business doesn't respond within 48 hours, we automatically send a follow-up email to maximize your response rate."
            />
            <FeatureCard
              icon={<TrendingUp className="w-12 h-12 text-indigo-600" />}
              title="Response Tracking"
              description="Monitor which businesses respond and see your conversion metrics in real-time."
            />
          </div>
      </section>

      {/* Why Perfect for Beginners & Empire Builders */}
      <section className="bg-gradient-to-r from-green-50 to-blue-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Perfect Whether You're Starting or Expanding
            </h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Don't have any machines placed yet? Never contacted a business before? No problem.
              Already running 20 machines and want 20 more? We handle the hardest part: finding and reaching out to locations.
              We help everyone from first-timers to seasoned operators expand their vending machine empire.            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h4 className="text-xl font-bold text-gray-900 mb-3">Without VendLocate Pro</h4>
              <ul className="space-y-2 text-gray-700">
                <li>• Spend weeks driving around looking for businesses</li>
                <li>• Waste time on locations that aren't interested</li>
                <li>• Struggle with what to say in outreach emails</li>
                <li>• Forget to follow up with potential leads</li>
                <li>• Miss out on high-traffic opportunities</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border-2 border-green-500">
              <h4 className="text-xl font-bold text-gray-900 mb-3">With VendLocate Pro</h4>
              <ul className="space-y-2 text-gray-700">
                <li>• Get 100+ qualified locations instantly</li>
                <li>• Personalized outreach emails sent automatically to every business</li>
                <li>• If they don't respond in 48 hours, we send a follow-up email automatically</li>
                <li>• Start with the best locations first</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Real Results from Vending Machine Operators
        </h3>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto text-lg">
          Join hundreds of operators who've used VendLocate to find, secure, and profit from premium vending locations.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
            <p className="text-gray-700 mb-4">
              "I made my money back 4 times over in the first month with just ONE location. 
              One apartment complex vending machine nets me $800/month and it took me 
              10 minutes to set up. VendLocate is insane ROI. I got 3 locations from it, 
              and I'm buying a bigger radius next week to unlock even more locations."
            </p>
            <div className="font-semibold text-gray-900">- Marcus T.</div>
            <div className="text-sm text-gray-600">Chicago, IL</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border-2 border-indigo-100">
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
            <p className="text-gray-700 mb-4">
              "I had never owned a vending machine before. Within one week of signing up, 
              VendLocate got me leads for 4 locations near my house. I met with the owners, 
              handed them the printed lead sheet, and 3 said yes on the spot. I'm now making 
              over $1,200/month in pure profit. This is the best way to start a vending empire."
            </p>
            <div className="font-semibold text-gray-900">- Sarah K.</div>
            <div className="text-sm text-gray-600">Austin, TX</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
            <p className="text-gray-700 mb-4">
              "I already had 8 machines running, but finding new locations was becoming impossible. 
              VendLocate helped me expand into neighboring cities and I added 6 more placements in 
              just one month. My empire is now 14 locations strong and growing. The automated 
              outreach alone saves me 20 hours a week. This paid for itself 10 times over."
            </p>
            <div className="font-semibold text-gray-900">- James P.</div>
            <div className="text-sm text-gray-600">Phoenix, AZ</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h3 className="text-3xl font-bold text-white mb-4">
            Stop Searching. Start Building Your Empire Today.
          </h3>
          <p className="text-xl text-indigo-100 mb-4">
            Whether it's your first machine or your hundredth — we find the locations, you build the empire.
          </p>
          <p className="text-lg text-indigo-200 mb-8">
            Pay once. Unlock your area's complete lead package. No subscriptions, no recurring fees.
          </p>
          <Link
            to="/register"
            className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
          >
            Start Building Now
          </Link>
          <p className="text-indigo-200 mt-3 text-sm">Join hundreds of operators already building their vending empires</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-6 h-6 text-indigo-400" />
                <h3 className="text-white font-bold text-lg">VendLocate Pro</h3>
              </div>
              <p className="text-sm">
                Helping vending machine operators find and secure premium locations since 2026.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/register" className="hover:text-indigo-400 transition-colors">Get Started</Link></li>
                <li><Link to="/login" className="hover:text-indigo-400 transition-colors">Login</Link></li>
                <li><Link to="/dashboard" className="hover:text-indigo-400 transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact Us</h4>
              <a href="mailto:evanbaker127@gmail.com" className="text-sm hover:text-indigo-400 transition-colors flex items-center gap-2">
                <Mail className="w-4 h-4" />
                evanbaker127@gmail.com
              </a>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-sm">
            <p>&copy; 2026 VendLocate Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h4 className="text-xl font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
