'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) {
      setError('Invalid email or password.');
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-fq-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="font-body text-[11px] tracking-[0.2em] uppercase text-fq-muted mb-2">Fox & Quinn</p>
          <h1 className="font-heading text-[28px] font-semibold text-fq-dark">Command Center</h1>
        </div>
        <div className="bg-fq-card border border-fq-border rounded-2xl p-8 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="font-body text-[12px] font-medium text-fq-dark/80 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="you@foxandquinn.co"
                className="w-full font-body text-[13px] text-fq-muted/80 bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/30"
              />
            </div>
            <div>
              <label className="font-body text-[12px] font-medium text-fq-dark/80 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full font-body text-[13px] text-fq-muted/80 bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/30"
              />
            </div>
            {error && <p className="font-body text-[12px] text-red-400">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full bg-fq-dark text-white font-body text-[13px] font-medium py-2.5 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </div>
        <p className="text-center font-body text-[11px] text-fq-muted/40 mt-6">Fox & Quinn · Internal Use Only</p>
      </div>
    </div>
  );
}
