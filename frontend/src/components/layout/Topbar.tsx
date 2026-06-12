import { Bell, Search, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/discover': 'Discover Startups',
  '/cv-score': 'CV Score Analysis',
  '/email-drafts': 'Email Drafts',
  '/applications': 'My Applications',
  '/settings': 'Settings',
};

export function Topbar() {
  const location = useLocation();
  const title = routeTitles[location.pathname] || 'Dashboard';

  return (
    <header className="sticky top-0 z-10 h-16 flex items-center justify-between px-8 bg-background/80 backdrop-blur-xl border-b border-white/5">
      <h1 className="text-xl font-display font-bold text-white">{title}</h1>
      
      <div className="flex flex-1 max-w-md mx-8">
        <div className="relative w-full group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-amber-500 transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-full leading-5 bg-surface-100/50 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 focus:bg-surface-200 transition-all sm:text-sm"
            placeholder="Search startups, emails, or applications..."
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-xs text-zinc-600 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">/</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        </button>
        <button className="p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
          <Moon size={18} />
        </button>
      </div>
    </header>
  );
}
