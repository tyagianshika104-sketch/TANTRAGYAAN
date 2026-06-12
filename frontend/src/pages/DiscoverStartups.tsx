import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Filter, Mail, MapPin, Search, Sparkles, Volume2, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ScoreRing } from '../components/ui/ScoreRing';
import { api, formatInr, Startup } from '../lib/api';

const categories = ['All', 'FinTech', 'AI', 'EdTech', 'HealthTech', 'Logistics', 'SaaS'];
const confidenceFilters = ['All', 'HIGH', 'MEDIUM', 'LOW'];
const sortOptions = [
  { id: 'score', label: 'Score' },
  { id: 'date', label: 'Date' },
  { id: 'amount', label: 'Funding' },
] as const;

function getScoreColor(s: number) {
  if (s >= 80) return 'text-emerald-400';
  if (s >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getConfBadge(c: string) {
  if (c === 'HIGH') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (c === 'MEDIUM') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-red-500/10 text-red-400 border-red-500/20';
}

function getSentimentBadge(s?: string) {
  if (s === 'positive' || s === 'BULLISH') return { text: '📈 Bullish', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  if (s === 'negative' || s === 'BEARISH') return { text: '📉 Bearish', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  return { text: '➖ Neutral', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
}

export default function DiscoverStartups() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [confFilter, setConfFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'amount'>('score');
  const [query, setQuery] = useState('');
  const [startups, setStartups] = useState<Startup[]>([]);
  const [message, setMessage] = useState('Loading startups from backend...');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [logs, setLogs] = useState<Array<{ time: string; message: string }>>([]);
  const [drafting, setDrafting] = useState('');
  const [playingTts, setPlayingTts] = useState('');

  const loadStartups = useCallback(() => {
    return api.getStartups()
      .then((result) => {
        setStartups(result.startups);
        setMessage(result.status.message);
        setIsDiscovering(result.status.running);
        setLogs(result.status.logs || []);
        return result.status;
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Could not load startups'));
  }, []);

  useEffect(() => { loadStartups(); }, [loadStartups]);

  useEffect(() => {
    if (!isDiscovering) return;
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const eventSource = new EventSource(`${API_BASE}/api/stream`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessage(data.message);
        setLogs(data.logs || []);
        setIsDiscovering(data.running);
        if (!data.running) { eventSource.close(); loadStartups(); }
      } catch {}
    };
    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, [isDiscovering, loadStartups]);

  const filteredStartups = useMemo(() => {
    let filtered = startups.filter((s) => {
      const hay = `${s.name} ${s.sector} ${s.round_type}`.toLowerCase();
      const catOk = activeCategory === 'All' || hay.includes(activeCategory.toLowerCase());
      const qOk = !query || hay.includes(query.toLowerCase());
      const confOk = confFilter === 'All' || s.confidence === confFilter;
      return catOk && qOk && confOk;
    });
    filtered.sort((a, b) => {
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
      if (sortBy === 'amount') return (b.amount_inr || 0) - (a.amount_inr || 0);
      return (b.date || '').localeCompare(a.date || '');
    });
    return filtered;
  }, [activeCategory, confFilter, query, startups, sortBy]);

  const handleRunDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const result = await api.runPipeline();
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not start discovery');
      setIsDiscovering(false);
    }
  };

  const handleDraftEmail = async (startup: Startup) => {
    setDrafting(startup.name);
    try {
      const draft = await api.draftEmail(startup.name);
      sessionStorage.setItem('ff-active-draft', JSON.stringify({ startup: startup.name, role: startup.role_match, ...draft }));
      window.location.href = '/email-drafts';
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not draft email');
    } finally {
      setDrafting('');
    }
  };

  const handleTts = async (startup: Startup) => {
    const text = `${startup.summary_what || ''} ${startup.summary_why || ''}`.trim();
    if (!text) return;
    setPlayingTts(startup.name);
    try {
      const blob = await api.ttsStartup(text);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setPlayingTts(''); URL.revokeObjectURL(url); };
        audio.play();
      } else {
        setPlayingTts('');
      }
    } catch {
      setPlayingTts('');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Sticky Header */}
      <div className="flex flex-col gap-4 sticky top-16 z-10 bg-background/90 backdrop-blur-xl py-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5">
        <div className="flex flex-col md:flex-row gap-3">
          <Input
            icon={<Search size={18} />}
            placeholder="Search startups, sectors..."
            className="md:max-w-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="outline" className="ml-auto shrink-0 gap-2 h-11 hidden md:flex" onClick={handleRunDiscovery} disabled={isDiscovering}>
            <Filter size={16} /> {isDiscovering ? 'Running...' : 'Run Discovery'}
          </Button>
        </div>

        {/* Sector filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'bg-surface-200 text-zinc-400 hover:text-white'}`}>
              {cat}
            </button>
          ))}
          <div className="w-px bg-white/10 mx-1 self-stretch" />
          {confidenceFilters.map(c => (
            <button key={c} onClick={() => setConfFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${confFilter === c ? 'bg-blue-500 text-white' : 'bg-surface-200 text-zinc-400 hover:text-white'}`}>
              {c === 'All' ? 'Any Conf.' : c}
            </button>
          ))}
          <div className="w-px bg-white/10 mx-1 self-stretch" />
          {sortOptions.map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id as typeof sortBy)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${sortBy === s.id ? 'bg-purple-500 text-white' : 'bg-surface-200 text-zinc-400 hover:text-white'}`}>
              <ArrowUpDown size={10} /> {s.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 py-1 text-amber-500">
          <Sparkles size={16} className={isDiscovering ? 'animate-spin' : ''} />
          <span className="text-xs font-medium">{message}</span>
          <span className="text-xs text-zinc-500 ml-2">{filteredStartups.length} results</span>
        </div>

        {logs.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-surface-100/70 p-2 text-xs text-zinc-400 max-h-20 overflow-y-auto">
            {logs.slice(-4).map((log, i) => (
              <div key={`${log.time}-${i}`} className="flex gap-2">
                <span className="font-mono text-zinc-500">{log.time}</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Startup Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStartups.map((startup, index) => {
          const sentiment = getSentimentBadge((startup as any).nlu_sentiment);
          const scoreVal = startup.score || 0;
          return (
            <motion.div key={`${startup.name}-${index}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.04 }} className="group">
              <motion.div whileHover={{ scale: 1.015, y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                <Card className={`p-5 h-full flex flex-col relative overflow-hidden transition-all duration-300 ${scoreVal > 85 ? 'hover:border-amber-500/50 hover:shadow-[0_0_25px_rgba(245,158,11,0.12)]' : 'hover:border-white/20'}`}>
                  {scoreVal > 85 && <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none" />}

                  {/* Header */}
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-surface-200 border border-white/10 flex items-center justify-center text-lg font-bold font-display text-white shrink-0">
                        {startup.name[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display font-semibold text-white group-hover:text-amber-400 transition-colors truncate">{startup.name}</h3>
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1"><MapPin size={9} /> India</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`text-xl font-bold font-display ${getScoreColor(scoreVal)}`}>{scoreVal}</span>
                      <span className="text-[9px] text-zinc-500">/ 100</span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3 relative z-10">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-200 text-zinc-300">{startup.sector || 'Startup'}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-200 text-zinc-300">{startup.round_type || 'Funding'}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{formatInr(startup.amount_inr)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getConfBadge(startup.confidence || 'MEDIUM')}`}>{startup.confidence || 'MEDIUM'}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${sentiment.cls}`}>{sentiment.text}</span>
                  </div>

                  {/* Role match */}
                  {startup.role_match && (
                    <div className="mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        🎯 {startup.role_match}
                      </span>
                    </div>
                  )}

                  {/* Summary */}
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-1">{startup.summary_what || 'Funded startup.'}</p>
                  <p className="text-xs text-zinc-500 line-clamp-2 mb-4 flex-1">{startup.summary_why || ''}</p>

                  {/* Footer */}
                  <div className="mt-auto relative z-10">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-3 pb-3 border-b border-white/5">
                      <span>{startup.source || 'API'}</span>
                      <span>{startup.date || ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="flex-none text-[10px] py-1 h-8 px-2" onClick={() => handleTts(startup)} disabled={playingTts === startup.name}>
                        <Volume2 size={12} className={playingTts === startup.name ? 'animate-pulse text-amber-400' : ''} />
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-[10px] py-1 h-8" onClick={() => window.open(startup.url, '_blank')} disabled={!startup.url}>
                        <ExternalLink size={12} /> Source
                      </Button>
                      <Button size="sm" className="flex-1 text-[10px] py-1 h-8 bg-purple-600 hover:bg-purple-500 text-white" onClick={() => handleDraftEmail(startup)} disabled={drafting === startup.name}>
                        <Mail size={12} /> {drafting === startup.name ? '...' : 'Email'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {filteredStartups.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <Search size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No startups match your filters</p>
          <p className="text-sm mt-1">Try adjusting your search or run a new discovery</p>
        </div>
      )}
    </div>
  );
}
