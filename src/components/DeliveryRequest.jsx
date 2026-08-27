import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { notify } from '../lib/notifications'

function DeliveryRequest({ order, user, onClose, onSuccess }) {
  const [pickupDate, setPickupDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    const { error } = await supabase.from('transport_requests').insert({
      order_id: order.id,
      farmer_id: user.id,
      pickup_location: order.listings?.location || '',
      pickup_date: pickupDate,
      notes: notes,
      status: 'pending',
    })

    setSubmitting(false)

    if (error) {
      notify.error('Failed to request transport')
    } else {
      notify.success('Transport requested! Transporters will be notified.')
      onSuccess()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white p-5 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Request Transport</h2>
            <p className="text-green-100 text-xs mt-0.5">
              {order.listings?.crop_type} · {order.quantity}kg · {order.listings?.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Order Summary */}
          <div className="bg-[#E8F5E9] rounded-lg p-3">
            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Order Summary</p>
            <p className="text-sm font-semibold text-gray-800">
              {order.listings?.crop_type} — {order.quantity}kg
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Pickup: {order.listings?.location}
            </p>
            <p className="text-xs text-gray-600">
              Value: ₦{Number(order.total_price).toLocaleString()}
            </p>
          </div>

          {/* Pickup Date */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              Preferred Pickup Date
            </label>
            <input
              type="date"
              required
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              Additional Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Call before arrival, fragile produce, gate code..."
              rows={3}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[var(--color-primary-dark)] text-white py-2.5 rounded-lg text-sm font-semibold hover:brightness-95 disabled:opacity-60 transition-all"
            >
              {submitting ? 'Requesting...' : 'Request Transport'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DeliveryRequest