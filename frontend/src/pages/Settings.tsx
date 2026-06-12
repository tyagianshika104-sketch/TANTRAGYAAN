import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AlertTriangle, CheckCircle2, Database, Mail, Shield, User } from 'lucide-react';
import { api, Profile } from '../lib/api';
import { useAuth } from '../lib/auth';

const profileFields: Array<{ key: keyof Profile; label: string; required?: boolean }> = [
  { key: 'name', label: 'Name', required: true },
  { key: 'degree', label: 'Degree', required: true },
  { key: 'cgpa', label: 'CGPA' },
  { key: 'year', label: 'Year', required: true },
  { key: 'skills', label: 'Skills', required: true },
  { key: 'experience', label: 'Experience', required: true },
  { key: 'location', label: 'Location' },
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'role_target', label: 'Target Role', required: true },
  { key: 'notice_period', label: 'Notice Period' },
  { key: 'expected_ctc', label: 'Expected CTC' },
];

const ALL_TRACKED_KEYS: (keyof Profile)[] = ['name', 'degree', 'cgpa', 'year', 'skills', 'experience', 'location', 'github', 'linkedin', 'role_target', 'notice_period', 'expected_ctc'];

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState<Profile>({});
  const [message, setMessage] = useState('');

  const displayName = form.name || profile?.name || 'Demo User';
  const avatar = profile?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10B981&color=fff&size=120`;

  useEffect(() => {
    api.getProfile().then(setForm).catch((err) => setMessage(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  const { completion, missingFields } = useMemo(() => {
    const filled = ALL_TRACKED_KEYS.filter(k => (form[k] || '').toString().trim().length > 0);
    const missing = ALL_TRACKED_KEYS.filter(k => !(form[k] || '').toString().trim());
    return { completion: Math.round((filled.length / ALL_TRACKED_KEYS.length) * 100), missingFields: missing };
  }, [form]);

  const updateField = (key: keyof Profile, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveProfile = async () => {
    setMessage('Saving...');
    try {
      await api.updateProfile(form);
      await refreshProfile();
      setMessage('Profile saved!');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save');
    }
  };

  const scrollToField = (key: string) => {
    document.getElementById(`field-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById(`input-${key}`)?.focus();
  };

  const completionColor = completion >= 80 ? 'text-emerald-400' : completion >= 60 ? 'text-amber-400' : 'text-red-400';
  const barColor = completion >= 80 ? 'bg-emerald-500' : completion >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-white mb-1">Settings</h2>
        <p className="text-zinc-400 text-sm">Manage your profile and integrations.</p>
      </div>

      {/* Profile Completion Meter */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-white text-sm flex items-center gap-2">
            {completion >= 80 ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
            Profile Completion
          </h3>
          <span className={`text-2xl font-display font-bold ${completionColor}`}>{completion}%</span>
        </div>

        <div className="w-full h-2.5 bg-surface-200 rounded-full overflow-hidden mb-3">
          <motion.div className={`h-full rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${completion}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        </div>

        {completion < 60 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3">
            <p className="text-xs text-amber-400 font-medium">⚠️ Profile below 60% — AI scoring and email drafting will be less accurate.</p>
          </div>
        )}

        {missingFields.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-zinc-500 mr-1">Missing:</span>
            {missingFields.map(k => {
              const field = profileFields.find(f => f.key === k);
              return (
                <button key={k} onClick={() => scrollToField(k)} className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer">
                  {field?.label || k}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Profile Form */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-surface-200 text-zinc-400"><User size={18} /></div>
          <h3 className="font-display font-semibold text-white text-sm">Profile</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center gap-3">
            <img src={avatar} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-surface-200" />
            <p className="text-[10px] text-zinc-500 text-center">From auth profile</p>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <label className="text-[10px] font-medium text-zinc-500 mb-1 block">Email Address</label>
              <Input value={form.email || profile?.email || ''} readOnly className="text-zinc-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profileFields.map((field) => (
                <div key={field.key} id={`field-${field.key}`}>
                  <label className="text-[10px] font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <Input id={`input-${field.key}`} value={String(form[field.key] || '')} onChange={(e) => updateField(field.key, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveProfile}>Save Profile</Button>
              {message && <span className="text-xs text-zinc-400">{message}</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Discovery Preferences */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-surface-200 text-zinc-400"><Database size={18} /></div>
          <h3 className="font-display font-semibold text-white text-sm">Discovery Preferences</h3>
        </div>
        <div>
          <label className="text-xs font-medium text-white mb-2 block">Target Sectors</label>
          <div className="flex flex-wrap gap-2">
            {(form.skills || 'FinTech, SaaS, AI/ML').split(',').map((sector) => (
              <span key={sector.trim()} className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-500">
                {sector.trim()}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Integrations */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-surface-200 text-zinc-400"><Mail size={18} /></div>
          <h3 className="font-display font-semibold text-white text-sm">Integrations</h3>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-surface-100/50">
          <div>
            <h4 className="font-medium text-white text-sm">Backend API</h4>
            <p className="text-[10px] text-zinc-500">Connected via Vite proxy</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => api.getHealth().then((h) => setMessage(`Health: ${JSON.stringify(h)}`))}>Check Health</Button>
        </div>
      </Card>

      {/* Account */}
      <Card className="p-6 border-red-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-500"><Shield size={18} /></div>
          <h3 className="font-display font-semibold text-white text-sm">Account</h3>
        </div>
        <p className="text-xs text-zinc-500">Account deletion is not available in the current version.</p>
      </Card>
    </div>
  );
}
