import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getBackendHealth } from '../lib/backendApi'
const flow = [
  { number: '01', title: 'Signal', text: 'A producer posts what is ready.' },
  { number: '02', title: 'Match', text: 'A buyer claims the right quantity.' },
  { number: '03', title: 'Move', text: 'A carrier takes it the final mile.' },
]

const roles = [
  { eyebrow: 'For producers', title: 'Turn harvest into leverage.', href: '/dashboard', tone: 'green' },
  { eyebrow: 'For buyers', title: 'Source without the guessing.', href: '/marketplace', tone: 'orange' },
  { eyebrow: 'For carriers', title: 'Keep every route moving.', href: '/logistics', tone: 'moss' },
]

function Arrow() {
  return <span aria-hidden="true" className="text-lg leading-none">↗</span>
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M20.5 3.5A11.9 11.9 0 0 0 12.03 0C5.45 0 .1 5.34.1 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.9 11.9 0 0 0 5.76 1.47h.01c6.58 0 11.92-5.35 11.92-11.92 0-3.19-1.23-6.18-3.46-8.41ZM12.04 21.8h-.01a9.88 9.88 0 0 1-5.04-1.38l-.36-.21-3.72.97.99-3.62-.23-.37a9.88 9.88 0 1 1 8.37 4.61Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  )
}

function LandingRedesign() {
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '2348000000000'
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Hello FreshSource, I need help with fresh produce.')}`
  const [backendOnline, setBackendOnline] = useState(false)

  useEffect(() => {
    getBackendHealth()
      .then((health) => setBackendOnline(health.status === 'ok'))
      .catch(() => setBackendOnline(false))
  }, [])

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--color-background-warm)]">
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link to="/" className="font-[var(--font-heading)] text-2xl italic text-[var(--color-primary-dark)]">FreshSource<span className="text-[var(--color-secondary)]">.</span></Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[var(--color-charcoal)]/70 md:flex">
          <Link to="/marketplace" className="transition-colors hover:text-[var(--color-primary)]">Marketplace</Link>
          <Link to="/dashboard" className="transition-colors hover:text-[var(--color-primary)]">Farmer desk</Link>
          <Link to="/logistics" className="transition-colors hover:text-[var(--color-primary)]">Carrier routes</Link>
        </nav>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] sm:flex"><i className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-secondary)]'}`} /> {backendOnline ? 'API online' : 'API offline'}</span><a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-bold text-[#102A2E] transition-transform hover:-translate-y-0.5"><WhatsAppMark /> WhatsApp us</a></div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-8 sm:px-8 md:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:pb-24">
        <div className="flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65 }}>
            <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-[var(--color-secondary-dark)]"><span className="h-px w-10 bg-[var(--color-secondary)]" /> Nigeria, in season</p>
            <h1 className="max-w-3xl font-[var(--font-heading)] text-5xl leading-[0.98] text-[var(--color-primary-dark)] sm:text-6xl lg:text-8xl">Good food should <span className="italic text-[var(--color-secondary)]">travel well.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[var(--color-charcoal)]/70 sm:text-lg">FreshSource makes the distance between a Nigerian harvest and your kitchen visible, timed, and worth the trip.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link to="/marketplace" className="inline-flex items-center justify-center gap-3 rounded-full bg-[var(--color-secondary)] px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-1 hover:shadow-lg">Explore today&apos;s harvest <Arrow /></Link><Link to="/auth" className="inline-flex items-center justify-center rounded-full border border-[var(--color-primary)] px-6 py-3.5 text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/5">Join the network</Link></div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="mt-12 grid max-w-lg grid-cols-3 gap-5 border-t border-black/10 pt-5"><div><p className="font-[var(--font-heading)] text-3xl text-[var(--color-primary-dark)]">12<span className="text-lg">h</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-charcoal)]/50">target pickup</p></div><div><p className="font-[var(--font-heading)] text-3xl text-[var(--color-primary-dark)]">01<span className="text-lg">kg</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-charcoal)]/50">traceable unit</p></div><div><p className="font-[var(--font-heading)] text-3xl text-[var(--color-primary-dark)]">03<span className="text-lg"> lanes</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-charcoal)]/50">to participate</p></div></motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="relative min-h-[430px] sm:min-h-[560px]"><div className="absolute inset-0 overflow-hidden rounded-[2rem] bg-[var(--color-primary-dark)]"><img src="/images/FreshSource.jpeg" alt="A Nigerian farmer working in a field" className="h-full w-full object-cover opacity-75 mix-blend-screen" /><div className="absolute inset-0 bg-gradient-to-t from-[var(--color-primary-dark)] via-transparent to-black/10" /></div><div className="absolute -bottom-5 left-4 right-4 rounded-2xl border border-white/20 bg-[var(--color-background-warm)]/95 p-4 shadow-2xl backdrop-blur sm:bottom-6 sm:left-6 sm:right-auto sm:w-72"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-secondary-dark)]">Live route</p><span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-primary)]"><i className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]" /> Active</span></div><p className="mt-3 font-[var(--font-heading)] text-2xl text-[var(--color-primary-dark)]">Ondo <span className="text-[var(--color-secondary)]">→</span> Lagos</p><div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 text-xs text-[var(--color-charcoal)]/60"><span>Next collection</span><strong className="text-[var(--color-charcoal)]">Today, 4:30 PM</strong></div></div><div className="absolute right-4 top-4 rounded-full bg-[var(--color-secondary)] px-4 py-2 text-xs font-bold text-white sm:right-6 sm:top-6">Harvest, not hype.</div></motion.div>
      </section>

      <section className="border-y border-black/10 bg-[var(--color-surface)] px-5 py-12 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-20"><div className="max-w-xs"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-secondary-dark)]">The FreshSource loop</p><h2 className="mt-3 font-[var(--font-heading)] text-3xl leading-tight text-[var(--color-primary-dark)]">From signal to supper.</h2></div><div className="grid flex-1 gap-6 sm:grid-cols-3">{flow.map((item, index) => <motion.div key={item.number} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="border-l-2 border-[var(--color-primary-light)] pl-4"><p className="text-xs font-bold text-[var(--color-secondary)]">{item.number}</p><h3 className="mt-2 font-[var(--font-heading)] text-xl text-[var(--color-primary-dark)]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--color-charcoal)]/65">{item.text}</p></motion.div>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12 lg:py-20"><div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-secondary-dark)]">Choose your lane</p><h2 className="mt-2 font-[var(--font-heading)] text-3xl text-[var(--color-primary-dark)] sm:text-4xl">There&apos;s room at the table.</h2></div><Link to="/role-switch" className="text-sm font-bold text-[var(--color-primary)] underline underline-offset-4">See all roles</Link></div><div className="grid gap-4 md:grid-cols-3">{roles.map((role, index) => <motion.div key={role.eyebrow} whileHover={{ y: -5 }} transition={{ duration: 0.2 }} className={`rounded-2xl p-6 ${role.tone === 'green' ? 'bg-[var(--color-primary-light)]/35' : role.tone === 'orange' ? 'bg-[var(--color-secondary-light)]/30' : 'bg-[var(--color-moss)]/25'}`}><p className="text-xs font-bold uppercase tracking-wider text-[var(--color-charcoal)]/60">0{index + 1} / {role.eyebrow}</p><div className="mt-12 flex items-end justify-between gap-4"><h3 className="font-[var(--font-heading)] text-2xl text-[var(--color-primary-dark)]">{role.title}</h3><Link to={role.href} aria-label={role.title} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-primary-dark)] shadow-sm transition-transform hover:rotate-12"><Arrow /></Link></div></motion.div>)}</div></section>

      <section className="bg-[var(--color-primary-dark)] px-5 py-12 text-white sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary-light)]">Need a human on the line?</p><h2 className="mt-2 font-[var(--font-heading)] text-3xl">Start with WhatsApp.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-white/65">Ask about today&apos;s supply, send an order, or get help finding the right carrier.</p></div><a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-3 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-bold text-[#102A2E] transition-transform hover:-translate-y-1"><WhatsAppMark /> Connect on WhatsApp <Arrow /></a></div></section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-[var(--color-charcoal)]/55 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p className="font-[var(--font-heading)] text-lg text-[var(--color-primary-dark)]">FreshSource<span className="text-[var(--color-secondary)]">.</span></p><p>Local harvests. Clear routes. Better food.</p><p>© 2026 FreshSource · Lagos, Nigeria</p></footer>
    </main>
  )
}

export default LandingRedesign
