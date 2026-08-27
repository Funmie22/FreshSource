import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'

const REGIONS = [
  'Lagos State',
  'Kano State',
  'Kaduna State',
  'Enugu State',
  'Rivers State',
  'Abuja Federal Capital Territory',
]

function FarmerRegistration() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.from('users').insert({
      role: 'farmer',
      name,
      phone: `+234${phone}`,
      region,
    })

    setSubmitting(false)

    if (error) {
      setError(error.message)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-white grid md:grid-cols-2">
      <div className="relative hidden md:block">
        <img
          src="/images/farmers/farmer-portrait.jpg"
          alt="Farmer in field"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute bottom-24 left-8 right-8 bg-black/40 backdrop-blur-sm text-white p-5 rounded-lg"
        >
          <p className="italic text-lg">
            "Digital tools are the new seeds. We plant them today to harvest efficiency
            tomorrow."
          </p>
          <p className="text-sm mt-3 text-white/80">— Kofi A., Lagos State Region</p>
        </motion.div>
        <Link
          to="/"
          className="absolute bottom-8 left-8 font-[var(--font-heading)] italic text-2xl text-white"
        >
          FreshSource
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col justify-center px-6 md:px-16 py-16"
      >
        <p className="text-xs font-semibold tracking-wide text-gray-500">STEP 01 / 04</p>
        <h1 className="font-[var(--font-heading)] text-3xl md:text-4xl mt-2">
          Farmer Registration
        </h1>
        <p className="mt-3 text-gray-600 text-sm max-w-sm">
          Join Nigeria's premium marketplace for agricultural excellence. Connect directly with
          logistics and institutional buyers.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 max-w-md">
          <div>
            <label className="text-xs font-semibold tracking-wide text-gray-500">
              FULL LEGAL NAME
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kwame Mensah"
              className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wide text-gray-500">
              PHONE NUMBER (MOBILE MONEY)
            </label>
            <div className="mt-2 flex">
              <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-sm text-gray-600">
                +234
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="24XXXXXXX"
                className="flex-1 border border-gray-300 rounded-r-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wide text-gray-500">
              AGRICULTURAL REGION
            </label>
            <select
              required
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            >
              <option value="">Select your region</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[var(--color-primary)] text-white py-3 rounded-md font-medium hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {submitting ? 'Registering...' : 'Continue Registration →'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default FarmerRegistration