import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

// Page Imports
import Landing from './pages/LandingRedesign'
import Auth from './pages/Auth'
import MarketHub from './pages/MarketHub'
import FarmerDashboard from './pages/FarmerDashboard'
import ProduceListing from './pages/ProduceListing'
import WholesaleRequest from './pages/WholesaleRequest'
import PaymentReturn from './pages/PaymentReturn'
import ShipmentStatus from './pages/ShipmentStatus'
import PurchaseHistory from './pages/PurchaseHistory'
import CarrierBoard from './pages/CarrierBoard'
import TrustReviews from './pages/TrustReviews'
import USSDListing from './pages/USSDListing'
import Terms from './pages/Terms'
import RolePicker from './pages/RolePicker'
import CarrierSignup from './pages/CarrierSignup'

// Auth Guard Wrapper
function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Fetch initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // 2. Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/marketplace" element={<MarketHub />} />
        <Route path="/product/:id" element={<ProduceListing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/register" element={<Auth />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/reviews" element={<TrustReviews />} />
        <Route path="/ussd" element={<USSDListing />} />
        <Route path="/transporter-registration" element={<CarrierSignup />} />
        <Route path="/payment-callback" element={<PaymentReturn />} />

        {/* Redirect Routes */}
        <Route path="/tracking" element={<Navigate to="/buyer-orders" replace />} />

        {/* Protected Dashboard & Action Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <FarmerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/role-switch"
          element={
            <ProtectedRoute>
              <RolePicker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buyer-orders"
          element={
            <ProtectedRoute>
              <PurchaseHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tracking/:orderId"
          element={
            <ProtectedRoute>
              <ShipmentStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logistics"
          element={
            <ProtectedRoute>
              <CarrierBoard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bulk-order"
          element={
            <ProtectedRoute>
              <WholesaleRequest />
            </ProtectedRoute>
          }
        />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App