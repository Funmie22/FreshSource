import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useCurrentUser } from '../lib/useCurrentUser'
import { getRecommended } from '../lib/matching'
import { isListingExpired } from '../lib/listingHelpers'
import { backendRequest } from '../lib/backendApi'
import SupplyMap from '../components/SupplyMap'
import DirectChat from '../components/DirectChat'
import Conversations from '../components/Conversations'

const CROP_TYPES = ['Tomatoes', 'Peppers', 'Garden Eggs', 'Okra']
const REGIONS = ['Lagos State', 'Kano State', 'Kaduna State', 'Enugu State', 'Rivers State', 'Abuja Federal Capital Territory']

function ListingCard({ listing, onMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow group"
    >
      <div className="relative h-40 bg-[var(--color-surface)] overflow-hidden">
        <img
          src={listing.image_url}
          alt={listing.crop_type}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
      </div>

      <div className="p-4">
        <h3 className="font-[var(--font-heading)] text-lg text-[var(--color-charcoal)]">
          {listing.crop_type}
        </h3>

        <p className="text-sm text-[var(--color-charcoal)]/60 mt-1">
          {listing.quantity}kg · ₦{listing.price_per_unit}/kg
        </p>

        <p className="text-xs text-[var(--color-charcoal)]/50 mt-2">
          {listing.location}
        </p>

        <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--color-charcoal)]/80">
              {listing.users?.name}
            </p>
            {listing.users?.rating && (
              <p className="text-xs text-[var(--color-secondary-dark)]">
                {listing.users.rating.toFixed(1)} rating
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Link
            to={`/product/${listing.id}`}
            className="block w-full bg-[var(--color-secondary)] text-white px-4 py-2 rounded-md text-sm font-medium text-center hover:brightness-95 transition-all active:scale-[0.98]"
          >
            View & Order
          </Link>
          <button
            onClick={() => onMessage(listing)}
            className="w-full border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--color-primary)]/5 transition-all"
          >
            Message Farmer
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function MarketHub() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCrop, setSelectedCrop] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [priceRange, setPriceRange] = useState([0, 5000])
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState('list')
  const [showChat, setShowChat] = useState(false)
  const [selectedChat, setSelectedChat] = useState(null)
  const [chatName, setChatName] = useState('')
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [newOrders, setNewOrders] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetchListings() {
      try {
        const apiListings = await backendRequest('/inventory')
        const data = apiListings.map((listing) => ({
          ...listing,
          users: { name: listing.farmer_name || 'FreshSource farmer' },
        }))
        let filtered = data.filter(
          (listing) =>
            Number(listing.price_per_unit) >= priceRange[0] &&
            Number(listing.price_per_unit) <= priceRange[1] &&
            (!selectedCrop || listing.crop_type === selectedCrop) &&
            (!selectedLocation || listing.location === selectedLocation) &&
            !isListingExpired(listing) &&
            listing.quantity > 0
        )

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          filtered = filtered.filter(
            (listing) =>
              listing.crop_type?.toLowerCase().includes(q) ||
              listing.location?.toLowerCase().includes(q) ||
              listing.freshness?.toLowerCase().includes(q) ||
              listing.users?.name?.toLowerCase().includes(q)
          )
        }

        setListings(filtered)
        setError(null)
      } catch (apiError) {
        let query = supabase
          .from('listings')
          .select('*, users(name, region, rating)')
          .order('created_at', { ascending: false })

        if (selectedCrop) query = query.eq('crop_type', selectedCrop)
        if (selectedLocation) query = query.eq('location', selectedLocation)

        const { data, error } = await query
        if (error) setError(apiError.message)
        else setListings(data.filter((listing) => !isListingExpired(listing) && listing.quantity > 0))
      }
      setLoading(false)
    }

    fetchListings()

    const listingsChannel = supabase
      .channel('marketplace-listings')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'listings' },
        () => fetchListings()
      )
      .subscribe()

    return () => supabase.removeChannel(listingsChannel)
  }, [selectedCrop, selectedLocation, priceRange, searchQuery])

  useEffect(() => {
    if (!user) return

    async function fetchUnread() {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('read', false)
      setUnreadMessages(msgs?.length || 0)

      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('status', 'confirmed')
      setNewOrders(orders?.length || 0)
    }
    fetchUnread()

    const channel = supabase
      .channel('buyer-notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => fetchUnread()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => fetchUnread()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  useEffect(() => {
    if (showChat || selectedChat) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showChat, selectedChat])

  const resetFilters = () => {
    setSelectedCrop('')
    setSelectedLocation('')
    setPriceRange([0, 5000])
    setSearchQuery('')
  }

  const activeFilterCount = [selectedCrop, selectedLocation].filter(Boolean).length

  const openChat = (listing) => {
    setSelectedChat(listing.farmer_id)
    setChatName(listing.users?.name)
    setShowChat(true)
  }

  const recommended = !selectedCrop && !selectedLocation && !searchQuery && listings.length > 3
    ? getRecommended(listings, 3)
    : []

  return (
    <div className="min-h-screen bg-[var(--color-background-warm)]">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-5 bg-[var(--color-primary-dark)] backdrop-blur-sm border-b border-black/10">
        <Link to="/" className="font-[var(--font-heading)] italic text-2xl text-white">
          FreshSource
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white">
          <span className="text-white/90">Marketplace</span>
          <Link to="/buyer-orders" className="text-white/70 hover:text-white relative transition-colors">
            My Orders
            {newOrders > 0 && (
              <span className="absolute -top-2 -right-3 bg-[var(--color-secondary)] text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {newOrders}
              </span>
            )}
          </Link>
          <Link to="/dashboard" className="text-white/70 hover:text-white transition-colors">Dashboard</Link>
          <Link to="/logistics" className="text-white/70 hover:text-white transition-colors">Logistics</Link>
        </nav>
        <div className="flex items-center gap-3">
          {user && <span className="text-xs text-white/50 hidden sm:inline">Logged in as {user?.name}</span>}
          {user && (
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/'
              }}
              className="text-xs border border-white/30 text-white/80 px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              Log Out
            </button>
          )}
          {!user && (
            <Link to="/auth" className="text-xs border border-white/30 text-white/80 px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
              Log In
            </Link>
          )}
        </div>
        {user && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black/10 z-40 flex items-center justify-around px-2 py-3">
            <Link to="/dashboard" className="flex flex-col items-center gap-1 text-xs text-[var(--color-charcoal)]/70">
              <span className="text-lg">🏠</span>Dashboard
            </Link>
            <Link to="/buyer-orders" className="flex flex-col items-center gap-1 text-xs text-[var(--color-charcoal)]/70">
              <span className="text-lg">📦</span>Orders
            </Link>
            <Link to="/logistics" className="flex flex-col items-center gap-1 text-xs text-[var(--color-charcoal)]/70">
              <span className="text-lg">🚛</span>Logistics
            </Link>
            <button onClick={() => navigate('/role-switch')} className="flex flex-col items-center gap-1 text-xs text-[var(--color-primary)]">
              <span className="text-lg">🔄</span>Switch Role
            </button>
          </nav>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-10 pb-24 md:pb-10">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex-1">
            <h1 className="font-[var(--font-heading)] text-3xl md:text-4xl text-[var(--color-charcoal)]">Marketplace</h1>
            <p className="mt-1 text-[var(--color-charcoal)]/60 text-sm">
              Browse fresh produce from verified farmers across Nigeria.
            </p>

            <div className="mt-4 flex gap-2 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search produce, location, farmer..."
                className="flex-1 border border-black/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-2 text-sm text-[var(--color-charcoal)]/60 hover:text-[var(--color-charcoal)] border border-black/10 rounded-lg bg-white transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <Link
              to="/bulk-order"
              className="inline-block mt-3 text-sm font-semibold text-[var(--color-primary)] underline hover:no-underline"
            >
              Need a large quantity? Request a bulk order →
            </Link>
          </div>

          <div className="flex gap-2 flex-shrink-0 flex-wrap mt-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden relative px-4 py-2 border border-black/10 rounded-md text-sm font-medium hover:bg-black/5 transition-colors"
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[var(--color-secondary)] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'border-black/10 text-[var(--color-charcoal)]/70'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                viewMode === 'map'
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'border-black/10 text-[var(--color-charcoal)]/70'
              }`}
            >
              Map
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${showFilters ? 'block' : 'hidden'} md:block md:col-span-1 space-y-6`}
          >
            <div className="md:hidden flex justify-between items-center mb-4">
              <h2 className="font-[var(--font-heading)] text-lg text-[var(--color-charcoal)]">Filters</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="text-[var(--color-charcoal)]/50 hover:text-[var(--color-charcoal)] text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="bg-white rounded-lg p-5 space-y-5 shadow-sm">
              <div>
                <label className="text-xs font-semibold tracking-wide text-[var(--color-charcoal)]/50 uppercase">Crop Type</label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="mt-2 w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 transition-all bg-white"
                >
                  <option value="">All Crops</option>
                  {CROP_TYPES.map((crop) => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold tracking-wide text-[var(--color-charcoal)]/50 uppercase">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="mt-2 w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 transition-all bg-white"
                >
                  <option value="">All Locations</option>
                  {REGIONS.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold tracking-wide text-[var(--color-charcoal)]/50 uppercase">
                  Price per KG: ₦{priceRange[0]} - ₦{priceRange[1]}
                </label>
                <div className="mt-3 space-y-2">
                  <input
                    type="range" min="0" max="5000" step="100"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="w-full h-2 bg-[var(--color-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
                  />
                  <input
                    type="range" min="0" max="5000" step="100"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full h-2 bg-[var(--color-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
                  />
                </div>
              </div>

              {(activeFilterCount > 0 || searchQuery) && (
                <button
                  onClick={resetFilters}
                  className="w-full py-2 border border-black/10 text-[var(--color-charcoal)]/70 rounded-md text-sm font-medium hover:bg-black/5 transition-colors"
                >
                  Reset All
                </button>
              )}
            </div>
          </motion.aside>

          <div className="md:col-span-3">
            {loading && <p className="text-center text-[var(--color-charcoal)]/60 py-12">Loading listings...</p>}
            {error && <p className="text-center text-red-500 py-12">Error: {error}</p>}

            {!loading && !error && listings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[var(--color-charcoal)]/60 mb-4">
                  {searchQuery ? `No listings found for "${searchQuery}"` : 'No listings match your filters.'}
                </p>
                <button onClick={resetFilters} className="text-[var(--color-primary)] font-medium hover:underline">
                  Clear filters
                </button>
              </div>
            )}

            {!loading && !error && listings.length > 0 && viewMode === 'map' && (
              <SupplyMap listings={listings} />
            )}

            {!loading && !error && listings.length > 0 && viewMode === 'list' && (
              <>
                {recommended.length > 0 && (
                  <div className="mb-8">
                    <h2 className="font-[var(--font-heading)] text-xl text-[var(--color-charcoal)] mb-4">
                      Recommended for You
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {recommended.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} onMessage={openChat} />
                      ))}
                    </div>
                    <div className="mt-8 border-t border-black/5" />
                  </div>
                )}

                {searchQuery && (
                  <p className="text-sm text-[var(--color-charcoal)]/60 mb-4">
                    {listings.length} result{listings.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onMessage={openChat} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-black/10 px-6 md:px-10 py-12 text-center mt-16">
        <div className="max-w-2xl mx-auto">
          <p className="font-[var(--font-heading)] text-[var(--color-charcoal)] text-lg">FreshSource</p>
          <div className="my-4 h-px bg-black/10" />
          <p className="text-[var(--color-charcoal)]/60 text-sm leading-relaxed mb-4">
            Empowering the backbone of Nigeria's economy through technology that respects the soil.
          </p>
          <p className="text-[var(--color-charcoal)]/40 text-xs tracking-wide">
            © 2026 FreshSource · Lagos, Lagos State, Nigeria
          </p>
        </div>
      </footer>

      {!showChat && !selectedChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 w-14 h-14 rounded-full bg-[var(--color-secondary)] text-white flex items-center justify-center shadow-lg hover:brightness-95 transition-all z-[9999]"
          title="Open messages"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 bg-[var(--color-secondary-dark)] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {unreadMessages}
            </span>
          )}
        </button>
      )}

      {(showChat || selectedChat) && (
        <div className="hidden md:block fixed right-6 bottom-6 z-50 w-96 shadow-2xl rounded-lg overflow-hidden" style={{ height: '480px' }}>
          {!selectedChat ? (
            <Conversations
              currentUser={user}
              onSelectConversation={(id, name) => { setSelectedChat(id); setChatName(name) }}
              onClose={() => { setShowChat(false); setSelectedChat(null) }}
            />
          ) : (
            <DirectChat
              conversationWith={selectedChat}
              conversationName={chatName}
              currentUser={user}
              onClose={() => { setSelectedChat(null); setShowChat(false) }}
            />
          )}
        </div>
      )}

      {(showChat || selectedChat) && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-50 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) { setShowChat(false); setSelectedChat(null) } }}>
          <div className="flex flex-col bg-white rounded-t-2xl overflow-hidden mt-auto" style={{ height: '85dvh' }}>
            {!selectedChat ? (
              <Conversations
                currentUser={user}
                onSelectConversation={(id, name) => { setSelectedChat(id); setChatName(name) }}
                onClose={() => { setShowChat(false); setSelectedChat(null) }}
              />
            ) : (
              <DirectChat
                conversationWith={selectedChat}
                conversationName={chatName}
                currentUser={user}
                onClose={() => { setSelectedChat(null); setShowChat(false) }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MarketHub