import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Briefcase, Clock, ChevronDown, ChevronUp, FileText, Send, CheckCircle2, XCircle } from 'lucide-react';
import { api, Application } from '../lib/api';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  APPLIED: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Applied' },
  applied: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Applied' },
  sent: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Sent' },
  FOLLOW_UP: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Follow Up' },
  follow_up: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Follow Up' },
  REJECTED: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected' },
  OFFER: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Offer!' },
  offer: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Offer!' },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.APPLIED;
}

export default function MyApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState('Loading applications...');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getApplications()
      .then((result) => { setApplications(result.applications); setMessage(''); })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  const stats = useMemo(() => {
    const applied = applications.filter(a => ['APPLIED', 'applied', 'sent'].includes(a.status || '')).length;
    const followups = applications.filter(a => ['FOLLOW_UP', 'follow_up'].includes(a.status || '')).length;
    const offers = applications.filter(a => ['OFFER', 'offer'].includes(a.status || '')).length;
    return { total: applications.length, applied, followups, offers };
  }, [applications]);

  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-white mb-1">My Applications</h2>
        <p className="text-zinc-400 text-sm">Track your outreach to funded startups.</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Briefcase, color: 'text-zinc-300', bg: 'bg-zinc-500/10' },
          { label: 'Applied', value: stats.applied, icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Follow Ups', value: stats.followups, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Offers', value: stats.offers, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}><s.icon size={18} /></div>
            <div>
              <p className="text-xl font-display font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-zinc-400">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {message && <p className="text-sm text-zinc-400 text-center">{message}</p>}

      {/* Application Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {applications.map((app, i) => {
          const id = app.id || String(i);
          const company = app.startup_name || app.company || 'Startup';
          const role = app.profile_used || 'Application';
          const status = app.status || 'APPLIED';
          const date = app.applied_date || app.applied_at || app.created_at || '';
          const subject = app.email_subject || '';
          const notes = app.notes || '';
          const style = getStatusStyle(status);
          const isExpanded = expandedNotes.has(id);

          return (
            <motion.div key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-4 hover:border-white/15 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-surface-200 border border-white/10 flex items-center justify-center text-lg font-bold font-display text-white shrink-0">
                    {company[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-white truncate">{company}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.bg} ${style.text} border-current/20 shrink-0`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">{role}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
                  <span className="flex items-center gap-1"><Clock size={10} /> {date ? new Date(date).toLocaleDateString() : 'Saved'}</span>
                  {subject && <span className="truncate ml-2 max-w-[180px]"><FileText size={10} className="inline mr-1" />{subject}</span>}
                </div>

                {notes && (
                  <button onClick={() => toggleNotes(id)} className="w-full flex items-center justify-between text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors mt-1 pt-2 border-t border-white/5">
                    <span>Notes</span>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
                {isExpanded && notes && (
                  <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{notes}</p>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {applications.length === 0 && !message && (
        <div className="text-center py-16 text-zinc-500">
          <Send size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No applications yet</p>
          <p className="text-sm mt-1">Draft an email from the Discover page to get started</p>
        </div>
      )}
    </div>
  );
}
