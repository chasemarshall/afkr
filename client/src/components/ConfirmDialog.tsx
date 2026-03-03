import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const desktopVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const mobileVariants = {
  hidden: { opacity: 0, y: '100%' },
  visible: { opacity: 1, y: 0 },
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'confirm',
  variant = 'default',
}: Props) {
  function handleConfirm(): void {
    onConfirm();
    onClose();
  }

  const confirmColor =
    variant === 'danger'
      ? 'text-red hover:opacity-70'
      : 'text-lavender hover:opacity-70';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-crust/70 backdrop-blur-sm sm:items-center"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* mobile: bottom sheet */}
          <motion.div
            className="w-full bg-mantle p-6 shadow-2xl shadow-crust/50 sm:hidden"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            variants={mobileVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface1" />
            <h3 className="mb-2 text-sm font-semibold text-text">{title}</h3>
            <p className="mb-6 text-xs text-subtext0">{message}</p>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="flex-1 py-2 text-xs text-overlay1 transition-colors hover:text-text"
              >
                cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                className={`flex-1 py-2 text-xs font-medium transition-opacity ${confirmColor}`}
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>

          {/* desktop: centered modal */}
          <motion.div
            className="hidden w-full max-w-sm bg-mantle p-6 shadow-2xl shadow-crust/50 sm:block"
            variants={desktopVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-text">{title}</h3>
            <p className="mb-6 text-xs text-subtext0">{message}</p>
            <div className="flex justify-end gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-overlay1 transition-colors hover:text-text"
              >
                cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                className={`px-3 py-1.5 text-xs font-medium transition-opacity ${confirmColor}`}
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
