import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { notify } from '../lib/notifications'

function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const firstInputRef = useRef(null)
  const emailInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === 'signup' && firstInputRef.current) {
        firstInputRef.current.focus()
      } else if (mode === 'login' && emailInputRef.current) {
        emailInputRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [mode])

  const validatePhone = (value) => {
    let cleaned = value.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1)
    }
    
    if (cleaned.length === 0) {
      setPhoneError('')
      return
    }
    
    const digitsRemaining = 10 - cleaned.length
    if (cleaned.length < 10) {
      setPhoneError(`Need ${digitsRemaining} more digit${digitsRemaining === 1 ? '' : 's'} (${cleaned.length}/10)`)
    } else if (cleaned.length === 10) {
      setPhoneError('Valid Nigerian phone number')
    }
  }

  const checkEmailExists = async (emailValue) => {
    if (!emailValue || mode === 'login' || !isSupabaseConfigured) return

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: 'checkonly123'
      })

      if (!error) {
        setEmailError('Email already registered - try logging in')
      } else if (error.message.includes('Invalid login')) {
        setEmailError('')
      }
    } catch {
      setEmailError('')
    }
  }

  const getFriendlyError = (errorMsg) => {
    if (errorMsg.includes('already registered')) return 'Email already in use - try logging in'
    if (errorMsg.includes('Invalid login')) return 'Wrong email or password'
    if (errorMsg.includes('password')) return 'Password must be at least 6 characters'
    if (errorMsg.includes('Email not confirmed')) return 'Check your email to confirm'
    return errorMsg
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable authentication.')
      setSubmitting(false)
      return
    }

    if (!agreeTerms) {
      setError('Please agree to the terms and conditions')
      setSubmitting(false)
      return
    }

    const formattedPhone = '+234' + phone

    const { data: existingPhone } = await supabase
      .from('users')
      .select('id')
      .eq('phone', formattedPhone)
      .maybeSingle()

    if (existingPhone) {
      setError('This phone number is already registered')
      setSubmitting(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError || !authData.user) {
      setError(getFriendlyError(authError?.message || 'Failed to sign up'))
      setSubmitting(false)
      return
    }

    const { error: profileError } = await supabase.from('users').insert({
      auth_id: authData.user.id,
      role: null,
      name,
      phone: formattedPhone,
    })

    if (profileError) {
      notify.error('Failed to create account profile')
      setError(getFriendlyError(profileError.message))
      setSubmitting(false)
    } else {
      notify.success('Account created! Welcome to FreshSource')
      setSuccess("You're all set. Redirecting to role selection...")
      setTimeout(() => {
        navigate('/role-switch')
      }, 1500)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable authentication.')
      setSubmitting(false)
      return
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      notify.error('Login failed')
      setError(getFriendlyError(authError?.message || 'Login failed'))
      setSubmitting(false)
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', data.user.id)
      .maybeSingle()

    let profile = userData
    if (!profile) {
      const fallbackName = data.user.user_metadata?.full_name
        || data.user.user_metadata?.name
        || data.user.email?.split('@')[0]
        || 'FreshSource user'
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          auth_id: data.user.id,
          role: null,
          name: fallbackName,
          phone: null,
        })

      if (profileError) {
        notify.error('Unable to load your account profile')
        setError(`Your login succeeded, but your account profile could not be created: ${profileError.message}`)
        setSubmitting(false)
        return
      }
      profile = { role: null }
    }

    const roleRoutes = {
      farmer: '/dashboard',
      buyer: '/marketplace',
      transporter: '/logistics',
    }

    notify.success('Logged in successfully!')
    setSuccess('Logged in successfully! Redirecting...')

    setTimeout(() => {
      if (profile?.role && roleRoutes[profile.role]) {
        navigate(roleRoutes[profile.role])
      } else {
        navigate('/role-switch')
      }
    }, 1200)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setResetSubmitting(true)
    setError(null)

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable authentication.')
      setResetSubmitting(false)
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(getFriendlyError(error.message))
    } else {
      setSuccess('Password reset link sent to your email')
      setTimeout(() => {
        setShowForgotPassword(false)
        setResetEmail('')
      }, 2000)
    }

    setResetSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF8] to-[#F5F3F0] flex items-center justify-center px-4 sm:px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 text-sm font-semibold text-gray-600 hover:text-[var(--color-primary)] transition-colors"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold text-[var(--color-primary-dark)] mb-8 text-center">FreshSource</h1>

        {/* Mode Toggle */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => {
              setMode('signup')
              setError(null)
              setSuccess(null)
            }}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold border-2 transition-all ${
              mode === 'signup'
                ? 'bg-[var(--color-primary-dark)] text-white border-[var(--color-primary-dark)]'
                : 'border-gray-300 text-gray-600'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => {
              setMode('login')
              setError(null)
              setSuccess(null)
            }}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold border-2 transition-all ${
              mode === 'login'
                ? 'bg-[var(--color-primary-dark)] text-white border-[var(--color-primary-dark)]'
                : 'border-gray-300 text-gray-600'
            }`}
          >
            Log In
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'signup' ? (
            <motion.form
              key="signup-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSignup}
              className="space-y-5"
            >
              <div>
                <label className="text-xs font-bold tracking-wider text-gray-700 uppercase">Full Name</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-xs font-bold tracking-wider text-gray-700 uppercase">Phone Number</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center px-3 py-3 border-2 border-gray-300 rounded-lg bg-gray-50">
                    <span className="text-sm font-semibold text-gray-600">+234</span>
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      let cleaned = e.target.value.replace(/\D/g, '')
                      if (cleaned.startsWith('0')) {
                        cleaned = cleaned.slice(1)
                      }
                      cleaned = cleaned.slice(0, 10)
                      setPhone(cleaned)
                      validatePhone(cleaned)
                    }}
                    className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
                    placeholder="7080 381788"
                    maxLength="10"
                    autoComplete="tel"
                  />
                </div>
                {phoneError && (
                  <p className={`text-xs mt-1 ${phoneError.includes('Valid') ? 'text-green-600' : 'text-red-600'} font-medium`}>
                    {phoneError}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold tracking-wider text-gray-700 uppercase">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => checkEmailExists(email)}
                  className="mt-2 w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
                  placeholder="your@email.com"
                  autoComplete="email"
                />
                {emailError && (
                  <p className={`text-xs mt-1 ${emailError.includes('already') ? 'text-red-600' : 'text-gray-600'} font-medium`}>
                    {emailError}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold tracking-wider text-gray-700 uppercase">Password</label>
                <div className="mt-2 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 pr-14 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 hover:text-[var(--color-primary)] transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-2 border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-gray-600 leading-relaxed">
                  I agree to FreshSource's{' '}
                  <a href="/terms" className="text-[var(--color-primary)] font-bold hover:underline">
                    Terms and Conditions
                  </a>
                </label>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border-2 border-red-200 rounded-lg p-4"
                >
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 border-2 border-green-200 rounded-lg p-4"
                >
                  <p className="text-sm text-green-700 font-medium">{success}</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={submitting || emailError.includes('already')}
                className="w-full bg-[var(--color-primary)] text-white py-3 rounded-lg font-bold hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60 mt-8 text-base"
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[var(--color-primary)] font-bold hover:underline"
                >
                  Log In
                </button>
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="login-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleLogin}
              className="space-y-5"
            >
              {showForgotPassword ? (
                <>
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Reset Password</h2>
                  <div>
                    <label className="text-xs font-bold tracking-wider text-gray-700 uppercase">Email</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="mt-2 w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border-2 border-red-200 rounded-lg p-4"
                    >
                      <p className="text-sm text-red-700 font-medium">{error}</p>
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-50 border-2 border-green-200 rounded-lg p-4"
                    >
                      <p className="text-sm text-green-700 font-medium">{success}</p>
                    </motion.div>
                  )}

                  <button
                    onClick={handleForgotPassword}
                    disabled={resetSubmitting}
                    className="w-full bg-[var(--color-primary)] text-white py-3 rounded-lg font-bold hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60 text-base"
                  >
                    {resetSubmitting ? 'Sending link...' : 'Send Reset Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setError(null)
                      setSuccess(null)
                    }}
                    className="w-full text-center text-sm font-semibold text-gray-600 hover:text-[var(--color-primary)] transition-colors"
                  >
                    Back to login
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold tracking-wider text-gray-700 uppercase">Email</label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold tracking-wider text-gray-700 uppercase">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-[var(--color-primary)] hover:underline font-semibold"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 pr-14 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
                        placeholder="Your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 hover:text-[var(--color-primary)] transition-colors"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border-2 border-red-200 rounded-lg p-4"
                    >
                      <p className="text-sm text-red-700 font-medium">{error}</p>
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-50 border-2 border-green-200 rounded-lg p-4"
                    >
                      <p className="text-sm text-green-700 font-medium">{success}</p>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[var(--color-primary)] text-white py-3 rounded-lg font-bold hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60 mt-8 text-base"
                  >
                    {submitting ? 'Logging in...' : 'Log In'}
                  </button>

                  <p className="text-center text-sm text-gray-600">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-[var(--color-primary)] font-bold hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                </>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default Auth