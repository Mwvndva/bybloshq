import { useEffect, useState } from 'react';
import type React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import creatorApi from '@/api/creatorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CreatorRegister() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const referralCode = params.get('ref') || '';
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mpesaNumber: '',
    instagramLink: '',
    tiktokLink: '',
    password: ''
  });

  useEffect(() => {
    if (!token) return;
    creatorApi.getInvite(token)
      .then((data) => {
        setInvite(data);
        setForm((current) => ({ ...current, email: data.email || '' }));
      })
      .catch((error) => toast.error(error?.response?.data?.message || 'Creator invite not found.'));
  }, [token]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await creatorApi.register({ token, ...form, referralCode });
      if (result?.data?.status === 'created') {
        toast.success('Creator access added. You can now log in.');
        navigate('/creator/login');
        return;
      }

      toast.success('Account created. Check your email to verify it.');
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}&type=creator`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not create creator account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">Creator invite</p>
          <h1 className="text-4xl font-black tracking-tight">Earn when your audience buys safely.</h1>
          <p className="text-sm font-medium leading-6 text-white/55">
            {invite ? `${invite.shopName} invited you to sell through Byblos.` : 'Accept your creator invite and get your tracked shop link.'}
          </p>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
          <Input value={form.firstName} onChange={(e) => updateForm('firstName', e.target.value)} placeholder="First name" className="h-11 border-white/10 bg-black/40" required />
          <Input value={form.lastName} onChange={(e) => updateForm('lastName', e.target.value)} placeholder="Last name" className="h-11 border-white/10 bg-black/40" required />
          <Input value={form.email} readOnly placeholder="Email" className="h-11 border-white/10 bg-black/40 text-white/70 sm:col-span-2" required />
          <Input value={form.mpesaNumber} onChange={(e) => updateForm('mpesaNumber', e.target.value)} placeholder="M-Pesa number" className="h-11 border-white/10 bg-black/40 sm:col-span-2" required />
          <Input value={form.instagramLink} onChange={(e) => updateForm('instagramLink', e.target.value)} placeholder="Instagram link" className="h-11 border-white/10 bg-black/40" />
          <Input value={form.tiktokLink} onChange={(e) => updateForm('tiktokLink', e.target.value)} placeholder="TikTok link" className="h-11 border-white/10 bg-black/40" />
          <Input value={form.password} onChange={(e) => updateForm('password', e.target.value)} type="password" placeholder="Password" className="h-11 border-white/10 bg-black/40 sm:col-span-2" required />
          <Button disabled={loading || !token} className="h-11 bg-yellow-400 font-black text-black hover:bg-yellow-300 sm:col-span-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create creator account'}
          </Button>
        </form>
      </div>
    </main>
  );
}
