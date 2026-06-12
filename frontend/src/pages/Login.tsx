import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, Sparkles, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../lib/auth';

type AuthMode = 'login' | 'signup';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-amber-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
        <div className="absolute bottom-[20%] right-[20%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] mix-blend-screen" style={{ animationDelay: '1s', animationDuration: '4s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="z-10 w-full max-w-md px-6"
      >
        <Card glass className="p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <span className="font-display font-bold text-3xl">FF</span>
            </div>

            <h1 className="font-display text-4xl font-bold tracking-tight mb-3 text-white">
              {isSignup ? 'Create account' : 'Welcome back'}
            </h1>
            <p className="text-zinc-400 text-base">
              {isSignup ? 'Sign up to start discovering funded startups.' : 'Log in to manage your startup applications.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-200 p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`h-10 rounded-lg text-sm font-medium transition-colors ${!isSignup ? 'bg-background text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`h-10 rounded-lg text-sm font-medium transition-colors ${isSignup ? 'bg-background text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              Sign up
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {isSignup && (
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Full Name</label>
                <Input
                  icon={<User size={18} />}
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Aarushi Sharma"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Email Address</label>
              <Input
                icon={<Mail size={18} />}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Password</label>
              <div className="relative">
                <Input
                  icon={<Lock size={18} />}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className="pr-12"
                  minLength={isSignup ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isSignup && (
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Confirm Password</label>
                <Input
                  icon={<Lock size={18} />}
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              className="w-full h-14 text-base bg-white text-black hover:bg-zinc-200 border-none shadow-[0_8px_30px_rgba(255,255,255,0.12)] hover:shadow-[0_8px_40px_rgba(255,255,255,0.2)] transition-all transform hover:-translate-y-0.5"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Please wait...' : isSignup ? 'Create Account' : 'Log In'}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/10 w-full flex flex-col items-center text-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
              <Sparkles size={12} className="text-purple-400" />
              Powered by Gemini AI
            </div>
            <p className="mt-6 text-xs text-zinc-500">
              {isSignup ? 'Already have an account? Use Log in above.' : 'New here? Use Sign up above to create one.'}
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
