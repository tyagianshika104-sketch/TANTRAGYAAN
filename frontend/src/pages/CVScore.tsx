import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, FileText, RefreshCw, Sparkles, UploadCloud, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  STRONG: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  GOOD: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  AVERAGE: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  WEAK: { bg: 'bg-red-500/15', text: 'text-red-400' },
};

const DONUT_COLORS = ['#f59e0b', '#8b5cf6', '#3b82f6'];

export default function CVScore() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [hasScored, setHasScored] = useState(false);
  const [fileName, setFileName] = useState('');
  const [score, setScore] = useState(0);
  const [grade, setGrade] = useState('AVERAGE');
  const [skillsScore, setSkillsScore] = useState(0);
  const [projectsScore, setProjectsScore] = useState(0);
  const [academicsScore, setAcademicsScore] = useState(0);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<Array<{ issue: string; fix: string }>>([]);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [verdict, setVerdict] = useState('Upload your CV to get AI-powered analysis.');
  const [error, setError] = useState('');
  const [aiEngine, setAiEngine] = useState('');
  const [expandedImprovement, setExpandedImprovement] = useState<number | null>(null);

  useEffect(() => {
    api.getHistory()
      .then((h) => {
        const s = h.cv_summary;
        if (s.latest_score || s.avg_score) {
          setScore(s.latest_score || s.avg_score || 0);
          setVerdict(s.latest_verdict || 'CV analysis available.');
          setMissingSkills(s.latest_missing_skills || []);
          setHasScored(true);
        }
      })
      .catch(() => {});
  }, []);

  const runAnalysis = async () => {
    setIsScoring(true);
    setError('');
    try {
      const analysis = await api.analyzeCv();
      if (analysis.ok && analysis.result) {
        const r = analysis.result;
        setHasScored(true);
        setScore(r.cv_score || 0);
        setGrade(r.grade || 'AVERAGE');
        setSkillsScore(r.skills_score || 0);
        setProjectsScore(r.projects_score || 0);
        setAcademicsScore(r.academics_score || 0);
        setStrengths(r.top_strengths || []);
        setImprovements(r.critical_improvements || []);
        setMissingSkills(r.missing_skills || []);
        setVerdict(r.hiring_verdict || 'Analysis complete.');
        setAiEngine(r.ai_engine || 'IBM Watsonx Granite');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setIsScoring(false);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) { setError('Upload a PDF, DOC, or DOCX.'); return; }
    setIsUploading(true);
    try {
      const result = await api.uploadCv(file);
      setFileName(result.cv_filename || file.name);
      setVerdict('CV uploaded. Analyzing...');
      await runAnalysis();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const donutData = [
    { name: 'Skills (40%)', value: skillsScore * 0.4 },
    { name: 'Projects (35%)', value: projectsScore * 0.35 },
    { name: 'Academics (25%)', value: academicsScore * 0.25 },
  ];
  const gradeStyle = GRADE_STYLES[grade] || GRADE_STYLES.AVERAGE;

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => handleFile(e.target.files?.[0])} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upload */}
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-1">Analyze Your CV</h2>
            <p className="text-zinc-400 text-sm">AI-powered analysis scored against startup sectors.</p>
          </div>
          <div
            className={`flex-1 min-h-[280px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-colors ${hasScored ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-surface-100/50 hover:border-amber-500/50'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          >
            {hasScored ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-3"><FileText size={28} /></div>
                <h3 className="text-lg font-display font-semibold text-white mb-1">{fileName || 'CV Analyzed'}</h3>
                <p className="text-emerald-400 text-xs mb-4 flex items-center gap-1"><CheckCircle2 size={12} /> Analysis complete</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Upload New</Button>
                  <Button variant="outline" size="sm" onClick={runAnalysis} disabled={isScoring}><RefreshCw size={14} className={isScoring ? 'animate-spin' : ''} /> Re-score</Button>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="h-14 w-14 rounded-full bg-surface-200 text-zinc-400 flex items-center justify-center mb-3 relative">
                  {(isUploading || isScoring) && <motion.div className="absolute inset-0 border-2 border-amber-500 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />}
                  <UploadCloud size={28} className={(isUploading || isScoring) ? 'text-amber-500' : ''} />
                </div>
                <h3 className="text-lg font-display font-semibold text-white mb-2">Drop your CV</h3>
                <p className="text-zinc-500 text-xs text-center mb-6 max-w-xs">PDF, DOC, or DOCX. Scored using IBM Watsonx Granite AI.</p>
                <Button className="w-full max-w-xs" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isScoring}>
                  {(isUploading || isScoring) ? <span className="flex items-center gap-2"><Sparkles size={14} className="animate-spin" /> Analyzing...</span> : 'Browse Files'}
                </Button>
              </>
            )}
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>

        {/* Right: Results */}
        <AnimatePresence mode="wait">
          <motion.div key="results" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
            <Card className="flex-1 p-6 overflow-y-auto scrollbar-hide">
              {/* Score Header with Donut */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-display font-bold text-white">{score}</span>
                    <span className="text-zinc-500 text-lg">/100</span>
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${gradeStyle.bg} ${gradeStyle.text} border-current/20`}>
                    {grade}
                  </div>
                </div>
                {hasScored && (
                  <div className="relative w-[120px] h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} innerRadius={38} outerRadius={55} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                          {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-white">{score}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Score Breakdown */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[{ label: 'Skills (40%)', val: skillsScore, color: 'text-amber-400' }, { label: 'Projects (35%)', val: projectsScore, color: 'text-purple-400' }, { label: 'Academics (25%)', val: academicsScore, color: 'text-blue-400' }].map(item => (
                  <div key={item.label} className="bg-surface-200/50 p-3 rounded-xl border border-white/5 text-center">
                    <div className={`text-xl font-bold ${item.color}`}>{item.val}</div>
                    <div className="text-[10px] text-zinc-400">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Strengths */}
              {strengths.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-display font-semibold text-white text-sm mb-2 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Top Strengths</h3>
                  <div className="space-y-1.5">
                    {strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Critical Improvements (Accordion) */}
              {improvements.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-display font-semibold text-white text-sm mb-2 flex items-center gap-2"><XCircle size={14} className="text-red-400" /> Critical Improvements</h3>
                  <div className="space-y-1.5">
                    {improvements.map((imp, i) => (
                      <div key={i} className="bg-surface-200/30 rounded-lg border border-white/5 overflow-hidden">
                        <button onClick={() => setExpandedImprovement(expandedImprovement === i ? null : i)} className="w-full flex items-center justify-between px-3 py-2 text-xs text-left">
                          <span className="font-medium text-red-400">{typeof imp === 'string' ? imp : imp.issue}</span>
                          {expandedImprovement === i ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
                        </button>
                        {expandedImprovement === i && typeof imp !== 'string' && imp.fix && (
                          <div className="px-3 pb-2 text-xs text-zinc-400">{imp.fix}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Skills */}
              <div className="mb-5">
                <h3 className="font-display font-semibold text-white text-sm mb-2">Missing Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(missingSkills.length ? missingSkills : ['Upload CV for analysis']).map((skill) => (
                    <span key={skill} className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[11px]">{skill}</span>
                  ))}
                </div>
              </div>

              {/* Verdict */}
              <div className="bg-surface-200/50 border border-white/5 rounded-xl p-4 mb-4">
                <h3 className="text-xs font-semibold text-zinc-300 mb-1">📋 Hiring Verdict</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{verdict}</p>
              </div>

              {/* Attribution */}
              <p className="text-[9px] text-zinc-600 text-center">
                Scored using {aiEngine || 'IBM Watsonx Granite'}
              </p>
            </Card>

            <div className="mt-3">
              <Button className="w-full gap-2" onClick={() => window.location.href = '/discover'}>
                Find Matching Startups <ArrowRight size={14} />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
