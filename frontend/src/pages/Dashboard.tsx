import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileBox, Mail, Mic, MicOff, Search, Send as SendIcon, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { api, Application, formatInr, Startup } from '../lib/api';
import { useAuth } from '../lib/auth';

const SUGGESTED_PROMPTS = [
  'Which startup should I apply to first?',
  'How can I improve my CV?',
  'What skills am I missing?',
];

const SECTOR_COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#ec4899'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [cvScore, setCvScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Loading...');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<Array<{ time: string; message: string }>>([]);

  // Co-Pilot state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: 'Hi! I\'m your IBM Watsonx Co-Pilot. Ask me about your startup matches, CV improvements, or career advice!' },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const loadDashboard = () => {
    return Promise.all([api.getStartups(), api.getHistory()])
      .then(([sr, h]) => {
        setStartups(sr.startups);
        setApplications(h.applications);
        setCvScore(h.cv_summary.latest_score || h.cv_summary.avg_score || 0);
        setStatusMessage(sr.status.message);
        setIsRunning(sr.status.running);
        setLogs(sr.status.logs || []);
      });
  };

  useEffect(() => {
    loadDashboard().catch((err) => setStatusMessage(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  useEffect(() => {
    if (!isRunning) return;
    const es = new EventSource(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stream`);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setStatusMessage(d.message); setLogs(d.logs || []); setIsRunning(d.running);
        if (!d.running) { es.close(); loadDashboard(); }
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [isRunning]);

  const handleAskCopilot = async (queryText?: string) => {
    const q = (queryText || chatInput).trim();
    if (!q) return;
    setChatInput('');
    setChatHistory(prev => [...prev.slice(-18), { role: 'user', text: q }]);
    setIsChatLoading(true);
    try {
      const res = await api.askCopilot(q);
      setChatHistory(prev => [...prev, { role: 'assistant', text: res.ok ? res.response : 'Error connecting to AI.' }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', text: 'Sorry, could not reach IBM Watsonx.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleMic = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const transcript = await api.sttTranscribe(blob);
        if (transcript) {
          setChatInput(transcript);
          handleAskCopilot(transcript);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      setStatusMessage('Microphone access denied');
    }
  };

  const runDiscovery = async () => {
    setIsRunning(true);
    try {
      const r = await api.runPipeline();
      setStatusMessage(r.message);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Error');
      setIsRunning(false);
    }
  };

  // Trending sectors data
  const sectorData = (() => {
    const counts: Record<string, number> = {};
    startups.forEach(s => { const sec = s.sector || 'Other'; counts[sec] = (counts[sec] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  })();

  const stats = [
    { label: 'Startups Found', value: startups.length, icon: Search, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Emails Drafted', value: applications.length, icon: Mail, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'CV Score', value: cvScore, suffix: '%', icon: FileBox, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Applied', value: applications.length, icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden border-none p-8 min-h-[200px] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-background to-purple-600/20" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between w-full gap-6">
            <div className="max-w-xl">
              <h1 className="font-display text-3xl font-bold mb-2 text-white">
                Welcome, {profile?.name?.split(' ')[0] || 'there'}
              </h1>
              <p className="text-zinc-400 mb-4">
                <strong className="text-zinc-200">{startups.length} startups</strong> loaded. {statusMessage}
              </p>
              <Button onClick={runDiscovery} className="gap-2 group" disabled={isRunning}>
                {isRunning ? 'Running...' : 'Run Discovery'} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <div className="hidden md:flex h-32 w-32 items-center justify-center relative">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
              <Sparkles size={52} className="text-amber-500 relative z-10" strokeWidth={1.5} />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Card className="p-4 hover:bg-surface-100/80 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}><stat.icon size={18} /></div>
              </div>
              <h3 className="text-2xl font-display font-bold text-white flex items-baseline">
                <AnimatedNumber value={stat.value} />
                {'suffix' in stat && stat.suffix && <span className="text-lg ml-0.5">{stat.suffix}</span>}
              </h3>
              <p className="text-xs text-zinc-400">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Startups + Trending */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-white">Recently Discovered</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/discover')}>View All</Button>
          </div>
          <div className="space-y-2">
            {startups.slice(0, 4).map((s) => (
              <Card key={s.name} className="p-3 flex items-center justify-between hover:bg-surface-200/50 transition-colors cursor-pointer group" onClick={() => navigate('/discover')}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-surface-200 border border-white/10 flex items-center justify-center font-bold font-display text-white shrink-0">{s.name[0]}</div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-white group-hover:text-amber-400 transition-colors truncate">{s.name}</h4>
                    <p className="text-[10px] text-zinc-400 truncate">{s.sector} • {formatInr(s.amount_inr)}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-400">{s.score}</span>
              </Card>
            ))}
          </div>

          {/* Trending Sectors Chart */}
          {sectorData.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-display font-semibold text-white mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-amber-500" /> Trending Sectors</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>

        {/* Co-Pilot Chat */}
        <div className="lg:col-span-2">
          <Card className="p-5 flex flex-col h-[500px] relative overflow-hidden border-purple-500/20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 to-purple-600" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400"><Sparkles size={16} /></div>
                <h3 className="font-display font-semibold text-white text-sm">IBM Watsonx Co-Pilot</h3>
              </div>
              <button onClick={() => setChatHistory([{ role: 'assistant', text: 'Chat cleared. How can I help?' }])} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Clear chat">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Suggested prompts */}
            {chatHistory.length <= 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {SUGGESTED_PROMPTS.map(p => (
                  <button key={p} onClick={() => handleAskCopilot(p)} className="px-3 py-1.5 rounded-full text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors">{p}</button>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-3 space-y-2 scrollbar-hide">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center mr-2 mt-1 shrink-0">
                      <Sparkles size={10} className="text-purple-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-surface-200 text-zinc-300 rounded-bl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center mr-2 shrink-0"><Sparkles size={10} className="text-purple-400" /></div>
                  <div className="bg-surface-200 text-zinc-400 px-3 py-2 rounded-xl rounded-bl-sm text-sm flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); handleAskCopilot(); }} className="relative flex items-center gap-2">
              <button type="button" onClick={handleMic} className={`p-2 rounded-lg transition-colors ${isRecording ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-surface-200 text-zinc-400 hover:text-purple-400'}`} title={isRecording ? 'Stop recording' : 'Voice input (IBM STT)'}>
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <input
                type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about your matches..."
                className="flex-1 bg-surface-200 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                disabled={isChatLoading}
              />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-purple-400 disabled:opacity-50">
                <SendIcon size={14} />
              </button>
            </form>
            <p className="text-[9px] text-zinc-600 text-center mt-2">Powered by IBM Watsonx Granite</p>
          </Card>
        </div>
      </div>

      {/* Live Logs */}
      {logs.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-display font-semibold text-white mb-3">Live Pipeline Logs</h3>
          <div className="relative border-l border-white/10 ml-2 space-y-3">
            {logs.slice(-6).map((item, i) => (
              <div key={`${item.time}-${i}`} className="relative pl-5">
                <div className={`absolute -left-1 top-1 h-2.5 w-2.5 rounded-full ${isRunning && i === logs.slice(-6).length - 1 ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'} ring-3 ring-surface-100`} />
                <p className="text-xs text-zinc-200">{item.message}</p>
                <p className="text-[10px] text-zinc-500">{item.time}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
