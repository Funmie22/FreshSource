import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProduceListing from './pages/ProduceListing'
import WholesaleRequest from './pages/WholesaleRequest'
import PaymentReturn from './pages/PaymentReturn'
import FarmerDashboard from './pages/FarmerDashboard'
import Landing from './pages/LandingRedesign'
import MarketHub from './pages/MarketHub'
import ShipmentStatus from './pages/ShipmentStatus'
import PurchaseHistory from './pages/PurchaseHistory'
import CarrierBoard from './pages/CarrierBoard'
import TrustReviews from './pages/TrustReviews'
import USSDListing from './pages/USSDListing'
import Terms from './pages/Terms'
import RolePicker from './pages/RolePicker'
import Auth from './pages/Auth'
import CarrierSignup from './pages/CarrierSignup'
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<FarmerDashboard />} />
        <Route path="/product/:id" element={<ProduceListing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/marketplace" element={<MarketHub />} />
        <Route path="/buyer-orders" element={<PurchaseHistory />} />
        <Route path="/tracking/:orderId" element={<ShipmentStatus />} />
        <Route path="/tracking" element={<Navigate to="/buyer-orders" replace />} />
        <Route path="/logistics" element={<CarrierBoard />} />
        <Route path="/register" element={<Auth />} />
        <Route path="/reviews" element={<TrustReviews />} />
        <Route path="/ussd" element={<USSDListing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/role-switch" element={<RolePicker />} />
        <Route path="/payment-callback" element={<PaymentReturn />} />
        <Route path="/bulk-order" element={<WholesaleRequest />} />
        <Route path="/transporter-registration" element={<CarrierSignup />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App