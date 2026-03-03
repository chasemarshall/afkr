import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAccounts, getServers } from '@/lib/api';
import ScriptStepCard from './ScriptStepCard';
import type { ScriptStep, ScriptTriggerType, Script, CreateScriptPayload } from '@afkr/shared';

const TRIGGER_TYPES: { value: ScriptTriggerType; label: string }[] = [
  { value: 'manual', label: 'manual' },
  { value: 'interval', label: 'interval (ms)' },
  { value: 'cron', label: 'cron' },
];

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (payload: CreateScriptPayload) => void;
  editScript?: Script | null;
  isPending?: boolean;
}

export default function ScriptBuilder({ open, onClose, onSave, editScript, isPending }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [serverId, setServerId] = useState('');
  const [triggerType, setTriggerType] = useState<ScriptTriggerType>('manual');
  const [triggerValue, setTriggerValue] = useState('');
  const [steps, setSteps] = useState<ScriptStep[]>([]);

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: getServers });

  useEffect(() => {
    if (editScript) {
      setName(editScript.name);
      setDescription(editScript.description || '');
      setAccountId(editScript.account_id);
      setServerId(editScript.server_id);
      setTriggerType(editScript.trigger_type);
      setTriggerValue(editScript.trigger_value || '');
      setSteps(editScript.steps);
    } else {
      resetForm();
    }
  }, [editScript, open]);

  function resetForm() {
    setName('');
    setDescription('');
    setAccountId('');
    setServerId('');
    setTriggerType('manual');
    setTriggerValue('');
    setSteps([]);
  }

  function addStep() {
    setSteps([...steps, { action: 'wait', params: { ms: 1000 } }]);
  }

  function updateStep(index: number, step: ScriptStep) {
    const next = [...steps];
    next[index] = step;
    setSteps(next);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      account_id: accountId,
      server_id: serverId,
      name: name.trim(),
      description: description.trim() || undefined,
      steps,
      trigger_type: triggerType,
      trigger_value: triggerType !== 'manual' ? triggerValue.trim() : undefined,
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-crust/70 p-4 backdrop-blur-sm sm:items-center sm:p-8"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg bg-base shadow-2xl shadow-crust/50 sm:rounded-lg"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface0 px-5 py-4">
              <h2 className="text-sm font-semibold text-text">
                {editScript ? 'edit script' : 'new script'}
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="text-overlay1 transition-colors hover:text-text"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-5">
              <div className="space-y-4">
                {/* Name + Description */}
                <div>
                  <label className="mb-1.5 block text-xs text-overlay1">name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my script"
                    maxLength={64}
                    className="w-full text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-overlay1">description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="optional description"
                    maxLength={256}
                    className="w-full text-sm"
                  />
                </div>

                {/* Account + Server */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-overlay1">account</label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full text-sm"
                    >
                      <option value="">select...</option>
                      {accounts?.map((a) => (
                        <option key={a.id} value={a.id}>{a.username}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-overlay1">server</label>
                    <select
                      value={serverId}
                      onChange={(e) => setServerId(e.target.value)}
                      className="w-full text-sm"
                    >
                      <option value="">select...</option>
                      {servers?.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Trigger */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-overlay1">trigger</label>
                    <select
                      value={triggerType}
                      onChange={(e) => setTriggerType(e.target.value as ScriptTriggerType)}
                      className="w-full text-sm"
                    >
                      {TRIGGER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  {triggerType !== 'manual' && (
                    <div>
                      <label className="mb-1.5 block text-xs text-overlay1">value</label>
                      <input
                        type="text"
                        value={triggerValue}
                        onChange={(e) => setTriggerValue(e.target.value)}
                        placeholder={triggerType === 'cron' ? '*/5 * * * *' : '30000'}
                        className="w-full text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Steps */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs text-overlay1">
                      steps ({steps.length}/200)
                    </label>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={addStep}
                      disabled={steps.length >= 200}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-lavender transition-opacity hover:opacity-70 disabled:opacity-40"
                    >
                      <Plus size={12} />
                      add step
                    </motion.button>
                  </div>

                  <div className="space-y-2">
                    <AnimatePresence>
                      {steps.map((step, i) => (
                        <ScriptStepCard
                          key={i}
                          step={step}
                          index={i}
                          onChange={updateStep}
                          onRemove={removeStep}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {steps.length === 0 && (
                    <p className="py-6 text-center text-xs text-overlay0">
                      no steps yet — click "add step" to begin
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex justify-end gap-3 border-t border-surface0 pt-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="text-xs text-overlay1 transition-colors hover:text-text"
                >
                  cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!name.trim() || !accountId || !serverId || isPending}
                  className="text-xs font-medium text-lavender transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {editScript ? 'save' : 'create'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
