import { useEffect, useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import creatorApi from '@/api/creatorApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type CreatorInvite = {
  email?: string;
  shopName?: string;
};

type ApiError = {
  response?: { data?: { message?: string } };
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
};

export default function CreatorRegister() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const referralCode = params.get('ref') || '';
  const [invite, setInvite] = useState<CreatorInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mpesaNumber: '',
    whatsappNumber: '',
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
      .catch((error: unknown) => toast.error(getErrorMessage(error, 'Creator invite not found.')));
  }, [token]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const passwordStrength = {
    minLength: form.password.length >= 8,
    hasNumber: /\d/.test(form.password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
    hasUpper: /[A-Z]/.test(form.password),
    hasLower: /[a-z]/.test(form.password)
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Could not create creator account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page byblos-light-page min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">
            {token ? 'Creator invite' : 'Byblos creators'}
          </p>
          <h1 className="text-4xl font-black tracking-tight">Earn when your audience buys safely.</h1>
          <p className="text-sm font-medium leading-6 text-white/55">
            {invite
              ? `${invite.shopName} invited you to sell through Byblos.`
              : 'Create a creator account, invite sellers with your link, and earn when their products sell.'}
          </p>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
          <Input value={form.firstName} onChange={(e) => updateForm('firstName', e.target.value)} placeholder="First name" className="h-11 border-white/10 bg-black/40" required />
          <Input value={form.lastName} onChange={(e) => updateForm('lastName', e.target.value)} placeholder="Last name" className="h-11 border-white/10 bg-black/40" required />
          <Input
            value={form.email}
            readOnly={Boolean(token)}
            onChange={(e) => updateForm('email', e.target.value)}
            type="email"
            placeholder="Email"
            className="h-11 border-white/10 bg-black/40 text-white/70 sm:col-span-2"
            required
          />
          <Input value={form.mpesaNumber} onChange={(e) => updateForm('mpesaNumber', e.target.value)} placeholder="M-Pesa number" className="h-11 border-white/10 bg-black/40 sm:col-span-2" required />
          <Input value={form.whatsappNumber} onChange={(e) => updateForm('whatsappNumber', e.target.value)} placeholder="WhatsApp number" className="h-11 border-white/10 bg-black/40 sm:col-span-2" required />
          <Input value={form.instagramLink} onChange={(e) => updateForm('instagramLink', e.target.value)} placeholder="Instagram link" className="h-11 border-white/10 bg-black/40" />
          <Input value={form.tiktokLink} onChange={(e) => updateForm('tiktokLink', e.target.value)} placeholder="TikTok link" className="h-11 border-white/10 bg-black/40" />
          <div className="relative sm:col-span-2">
            <Input value={form.password} onChange={(e) => updateForm('password', e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Password" className="h-11 border-white/10 bg-black/40 pr-12" required />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.password && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:col-span-2">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/50">Password checklist</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: '8+ characters', met: passwordStrength.minLength },
                  { label: '1 number', met: passwordStrength.hasNumber },
                  { label: '1 special character', met: passwordStrength.hasSpecial },
                  { label: 'Upper and lowercase', met: passwordStrength.hasUpper && passwordStrength.hasLower }
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs font-bold">
                    <span className={`rounded-full p-0.5 ${item.met ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/35'}`}>
                      {item.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <span className={item.met ? 'text-green-300' : 'text-white/45'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <Button disabled={loading} className="h-11 bg-yellow-400 font-black text-black hover:bg-yellow-300">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create creator account'}
            </Button>
            <Link to="/creator/login" className="inline-flex h-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-4 text-sm font-black text-white transition hover:bg-white/10">
              Creator login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
