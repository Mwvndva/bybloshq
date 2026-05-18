import { useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import creatorApi from '@/api/creatorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CreatorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await creatorApi.login(email, password);
      localStorage.setItem('creatorSessionActive', 'true');
      navigate('/creator/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not log in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <form onSubmit={handleSubmit} className="w-full space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Byblos creators</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Creator login</h1>
            <p className="mt-2 text-sm font-medium text-white/50">Track your shop links, completed sales, and referral earnings.</p>
          </div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="h-11 border-white/10 bg-black/40" required />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="h-11 border-white/10 bg-black/40" required />
          <Button disabled={loading} className="h-11 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log in'}
          </Button>
        </form>
      </div>
    </main>
  );
}
