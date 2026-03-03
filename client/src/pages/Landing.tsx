import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

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

const features = [
  {
    title: 'multi-account',
    description: 'manage dozens of bots from a single dashboard. add, remove, and monitor accounts effortlessly.',
    color: 'text-lavender',
  },
  {
    title: 'auto-reconnect',
    description: 'bots reconnect automatically on disconnect. set it and forget it — your accounts stay online.',
    color: 'text-green',
  },
  {
    title: 'scheduled commands',
    description: 'queue up commands on a timer. automate fishing, farming, or any repeating action with cron-like precision.',
    color: 'text-peach',
  },
  {
    title: 'real-time monitoring',
    description: 'live health, chat, and position data streamed to your browser. know exactly what every bot is doing.',
    color: 'text-sapphire',
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
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-5 lg:px-16"
      >
        <span className="text-sm font-semibold tracking-wide text-text">afkr.</span>
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
        {/* subtle grid bg */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-surface1) 1px, transparent 1px), linear-gradient(90deg, var(--color-surface1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* radial glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, var(--color-lavender), transparent 70%)' }}
        />

        <div className="relative z-10 max-w-2xl text-center">
          <motion.h1
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-5xl font-bold tracking-tight text-text sm:text-7xl"
          >
            afkr.
          </motion.h1>

          <motion.p
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mx-auto mt-6 max-w-md text-base leading-relaxed text-subtext0 sm:text-lg"
          >
            keep your minecraft bots online while you're away. manage, monitor, and automate — all from one place.
          </motion.p>

          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-10"
          >
            <Link
              to="/login"
              className="group relative inline-flex items-center gap-2 rounded-lg border border-surface1 bg-mantle px-6 py-3 text-sm text-text transition-all duration-300 hover:border-lavender hover:text-lavender"
            >
              <span>get started</span>
              <motion.span
                className="inline-block"
                initial={{ x: 0 }}
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                &rarr;
              </motion.span>
            </Link>
          </motion.div>
        </div>

        {/* scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-10 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] tracking-widest text-overlay0 uppercase">scroll</span>
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
          className="mb-16 text-xs tracking-widest text-overlay0 uppercase"
        >
          what you get
        </motion.p>

        <div className="grid gap-px rounded-xl border border-surface0 bg-surface0 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="flex flex-col gap-3 bg-base p-8 sm:p-10 first:rounded-tl-xl first:sm:rounded-bl-xl last:rounded-br-xl last:sm:rounded-tr-xl [&:nth-child(2)]:rounded-tr-xl [&:nth-child(2)]:sm:rounded-tr-xl [&:nth-child(3)]:rounded-bl-xl [&:nth-child(3)]:sm:rounded-bl-xl"
            >
              <h3 className={`text-sm font-semibold ${f.color}`}>{f.title}</h3>
              <p className="text-sm leading-relaxed text-subtext0">{f.description}</p>
            </motion.div>
          ))}
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
          <span className="text-[10px] text-overlay0">built for block games</span>
        </div>
      </footer>
    </div>
  );
}
