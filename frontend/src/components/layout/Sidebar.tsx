import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Compass, 
  FileBox, 
  Mail, 
  ClipboardList, 
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '../ui/utils';
import { motion } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { icon: Home, label: 'Dashboard', path: '/' },
  { icon: Compass, label: 'Discover Startups', path: '/discover' },
  { icon: FileBox, label: 'CV Score', path: '/cv-score' },
  { icon: Mail, label: 'Email Drafts', path: '/email-drafts' },
  { icon: ClipboardList, label: 'My Applications', path: '/applications' },
  { icon: SettingsIcon, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.name || 'Demo User';
  const displayEmail = profile?.email || 'demo@example.com';
  const avatar = profile?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10B981&color=fff`;

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 260 }}
      className="sticky top-0 h-screen flex flex-col border-r border-white/5 bg-surface-100/50 backdrop-blur-xl z-20 transition-all duration-300"
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500 border border-amber-500/30">
            <span className="font-display font-bold text-sm">FF</span>
          </div>
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-display font-bold text-lg tracking-wide whitespace-nowrap"
            >
              FundedFirst
            </motion.span>
          )}
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative overflow-hidden",
              isActive 
                ? "text-amber-400 bg-amber-500/10" 
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-full"
                  />
                )}
                <item.icon size={20} className={cn("shrink-0", isActive ? "text-amber-500" : "group-hover:text-zinc-200")} />
                {!isCollapsed && (
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "")}>
          <img 
            src={avatar}
            alt="User" 
            className="h-10 w-10 rounded-full border border-white/10 shrink-0"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-zinc-500 truncate">{displayEmail}</p>
            </div>
          )}
          {!isCollapsed && (
            <button
              className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
