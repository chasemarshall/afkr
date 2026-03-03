import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Database,
  Zap,
  Users,
  CalendarClock,
  Activity,
  RefreshCw,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const features = [
  {
    title: 'multi-account',
    description:
      'manage dozens of bots from a single dashboard. add, remove, and monitor accounts effortlessly.',
    Icon: Users,
    accent: 'text-lavender',
    glow: 'var(--color-lavender)',
  },
  {
    title: 'auto-reconnect',
    description:
      'bots reconnect automatically on disconnect. set it and forget it — your accounts stay online.',
    Icon: RefreshCw,
    accent: 'text-green',
    glow: 'var(--color-green)',
  },
  {
    title: 'scheduled commands',
    description:
      'queue up commands on a timer. automate fishing, farming, or any repeating action with cron-like precision.',
    Icon: CalendarClock,
    accent: 'text-peach',
    glow: 'var(--color-peach)',
  },
  {
    title: 'real-time monitoring',
    description:
      'live health, chat, and position data streamed to your browser. know exactly what every bot is doing.',
    Icon: Activity,
    accent: 'text-sapphire',
    glow: 'var(--color-sapphire)',
  },
];

const securityFacts = [
  {
    Icon: Lock,
    label: 'encrypted at rest',
    detail: 'microsoft tokens encrypted with AES-256-GCM before hitting the database. 12-byte IV, 128-bit auth tag.',
    accent: 'text-green',
  },
  {
    Icon: EyeOff,
    label: 'never exposed',
    detail: 'credentials are never returned by the API. redacted from all logs. only decrypted in-memory when connecting a bot.',
    accent: 'text-sapphire',
  },
  {
    Icon: Database,
    label: 'row-level security',
    detail: 'supabase RLS policies enforce data isolation at the postgres level. you can only query your own rows.',
    accent: 'text-lavender',
  },
  {
    Icon: Shield,
    label: 'rate limited',
    detail: 'per-IP HTTP limits + per-socket event limits. auth endpoints capped at 5 req / 5 min. abuse = instant disconnect.',
    accent: 'text-peach',
  },
  {
    Icon: Zap,
    label: 'device code flow',
    detail: 'we never see your microsoft password. you authenticate directly with microsoft via device code — we only cache the resulting token.',
    accent: 'text-yellow',
  },
  {
    Icon: Eye,
    label: 'honest trade-off',
    detail: 'the server must decrypt tokens to connect bots on your behalf. this is not zero-knowledge. we\'re upfront about that.',
    accent: 'text-red',
  },
];

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <div className="min-h-screen bg-base">
      {/* nav */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-surface0/30 bg-base/80 px-6 py-4 backdrop-blur-md lg:px-16"
      >
        <span className="text-sm font-semibold tracking-wide text-text">
          afkr.
        </span>
        <Link
          to="/login"
          className="text-xs text-subtext0 transition-colors duration-200 hover:text-lavender"
        >
          sign in
        </Link>
      </motion.nav>

      {/* hero */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative flex min-h-screen flex-col items-center justify-center px-6"
      >
        {/* grid bg */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-surface1) 1px, transparent 1px), linear-gradient(90deg, var(--color-surface1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* radial glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06]"
          style={{
            background:
              'radial-gradient(circle, var(--color-lavender), transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-2xl text-center">
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-surface0 bg-mantle/60 px-4 py-1.5"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green animate-subtle-pulse" />
            <span className="text-[10px] tracking-wider text-subtext0">
              self-hosted &middot; open source
            </span>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-5xl font-bold tracking-tight text-text sm:text-7xl"
          >
            afkr.
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mx-auto mt-6 max-w-md text-base leading-relaxed text-subtext0 sm:text-lg"
          >
            keep your minecraft bots online while you're away. manage, monitor,
            and automate — all from one place.
          </motion.p>

          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              to="/login"
              className="group relative inline-flex items-center gap-2 rounded-lg bg-lavender px-6 py-3 text-sm font-semibold text-crust transition-all duration-300 hover:opacity-90"
            >
              get started
              <motion.span
                className="inline-block"
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                &rarr;
              </motion.span>
            </Link>
            <a
              href="#security"
              className="inline-flex items-center gap-2 text-xs text-overlay1 transition-colors duration-200 hover:text-text"
            >
              <Shield size={12} />
              how we handle your data
            </a>
          </motion.div>
        </div>

        {/* scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-10 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] uppercase tracking-widest text-overlay0">
            scroll
          </span>
          <motion.div
            className="h-8 w-px bg-surface1"
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ originY: 0 }}
          />
        </motion.div>
      </motion.section>

      {/* features */}
      <section className="relative mx-auto max-w-5xl px-6 py-32 lg:px-16">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-xs uppercase tracking-widest text-overlay0"
        >
          what you get
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
          className="grid gap-px rounded-xl border border-surface0 bg-surface0 sm:grid-cols-2"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              custom={0}
              className="group relative flex flex-col gap-3 overflow-hidden bg-base p-8 transition-colors duration-300 hover:bg-mantle/50 sm:p-10 first:rounded-tl-xl first:sm:rounded-bl-xl last:rounded-br-xl last:sm:rounded-tr-xl [&:nth-child(2)]:rounded-tr-xl [&:nth-child(2)]:sm:rounded-tr-xl [&:nth-child(3)]:rounded-bl-xl [&:nth-child(3)]:sm:rounded-bl-xl"
            >
              {/* hover glow */}
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.08]"
                style={{ background: f.glow }}
              />
              <div className="flex items-center gap-2.5">
                <f.Icon size={14} className={f.accent} />
                <h3 className={`text-sm font-semibold ${f.accent}`}>
                  {f.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-subtext0">
                {f.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* security & privacy */}
      <section
        id="security"
        className="relative border-t border-surface0 scroll-mt-20"
      >
        {/* background texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'radial-gradient(var(--color-surface1) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-32 lg:px-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="mb-4 text-xs uppercase tracking-widest text-overlay0"
            >
              security & privacy
            </motion.p>

            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mb-4 text-2xl font-semibold text-text sm:text-3xl"
            >
              no trust required — read the receipts
            </motion.h2>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mb-16 max-w-lg text-sm leading-relaxed text-subtext0"
            >
              we believe you should know exactly how your data is handled.
              here's the full picture — including the parts most services
              wouldn't tell you.
            </motion.p>
          </motion.div>

          {/* security grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {securityFacts.map((fact) => (
              <motion.div
                key={fact.label}
                variants={fadeUp}
                custom={0}
                className="group rounded-lg border border-surface0 bg-mantle/30 p-6 transition-colors duration-300 hover:border-surface1 hover:bg-mantle/60"
              >
                <div className="mb-3 flex items-center gap-2">
                  <fact.Icon size={14} className={fact.accent} />
                  <span className={`text-xs font-semibold ${fact.accent}`}>
                    {fact.label}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-overlay1">
                  {fact.detail}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* what we store vs don't */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            className="mt-16 grid gap-px overflow-hidden rounded-xl border border-surface0 bg-surface0 sm:grid-cols-2"
          >
            <motion.div
              variants={fadeUp}
              custom={0}
              className="bg-base p-8"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-green">
                what we store
              </p>
              <ul className="space-y-2.5 text-sm text-subtext0">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">$</span>
                  your email (for auth)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">$</span>
                  minecraft username
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">$</span>
                  microsoft auth token{' '}
                  <span className="text-green">(encrypted)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">$</span>
                  server addresses you add
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">$</span>
                  command history & bot sessions
                </li>
              </ul>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={1}
              className="bg-base p-8"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-red">
                what we never store
              </p>
              <ul className="space-y-2.5 text-sm text-subtext0">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">~</span>
                  your microsoft password
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">~</span>
                  plaintext tokens (always encrypted)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">~</span>
                  other users' data (RLS enforced)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">~</span>
                  analytics or tracking cookies
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-surface2">~</span>
                  anything we don't need
                </li>
              </ul>
            </motion.div>
          </motion.div>

          {/* encryption detail callout */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 rounded-lg border border-surface0 bg-crust/50 p-6"
          >
            <p className="mb-2 text-[10px] uppercase tracking-widest text-overlay0">
              encryption details
            </p>
            <code className="block text-xs leading-loose text-overlay1">
              <span className="text-mauve">algorithm</span>
              <span className="text-surface2"> = </span>
              <span className="text-green">"aes-256-gcm"</span>
              <br />
              <span className="text-mauve">key_size</span>
              <span className="text-surface2"> = </span>
              <span className="text-peach">256</span>
              <span className="text-overlay0"> bits</span>
              <br />
              <span className="text-mauve">iv_size</span>
              <span className="text-surface2"> = </span>
              <span className="text-peach">96</span>
              <span className="text-overlay0"> bits (NIST recommended)</span>
              <br />
              <span className="text-mauve">auth_tag</span>
              <span className="text-surface2"> = </span>
              <span className="text-peach">128</span>
              <span className="text-overlay0">
                {' '}
                bits (tamper detection)
              </span>
              <br />
              <span className="text-mauve">stored_as</span>
              <span className="text-surface2"> = </span>
              <span className="text-green">"base64(iv + tag + ciphertext)"</span>
            </code>
          </motion.div>
        </div>
      </section>

      {/* bottom cta */}
      <section className="border-t border-surface0 px-6 py-24 text-center lg:px-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mx-auto max-w-md"
        >
          <motion.h2
            custom={0}
            variants={fadeUp}
            className="text-2xl font-semibold text-text sm:text-3xl"
          >
            ready to go afk?
          </motion.h2>
          <motion.p
            custom={1}
            variants={fadeUp}
            className="mt-4 text-sm text-subtext0"
          >
            set up your first bot in under a minute.
          </motion.p>
          <motion.div custom={2} variants={fadeUp} className="mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-lavender px-6 py-3 text-sm font-semibold text-crust transition-all duration-300 hover:opacity-90"
            >
              get started free
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* footer */}
      <footer className="border-t border-surface0 px-6 py-8 lg:px-16">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xs text-overlay0">afkr.</span>
          <span className="text-[10px] text-overlay0">
            built for block games
          </span>
        </div>
      </footer>
    </div>
  );
}
