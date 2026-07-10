import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatorRegisterMutation } from '@/hooks/creator/mutations/useCreatorAuthMutations';
import { useCreatorInviteQuery } from '@/hooks/creator/queries/useCreatorInviteQuery';
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mpesaNumber: '',
    whatsappNumber: '',
    password: '',
    confirmPassword: ''
  });

  const { data: inviteData, error: inviteError } = useCreatorInviteQuery(token, !!token);

  useEffect(() => {
    if (inviteData) {
      setInvite(inviteData);
      setForm((current) => ({ ...current, email: inviteData.email || '' }));
    }
  }, [inviteData]);

  useEffect(() => {
    if (inviteError) {
      toast.error(getErrorMessage(inviteError, 'Ambassador invite not found.'));
    }
  }, [inviteError]);

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
  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;

  const registerMutation = useCreatorRegisterMutation();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await registerMutation.mutateAsync({ token, ...form, referralCode } as unknown as Parameters<typeof registerMutation.mutateAsync>[0]) as Record<string, unknown>;
      if ((result?.data as Record<string, unknown>)?.status === 'created') {
        toast.success('Ambassador access added. You can now log in.');
        navigate('/creator/login');
        return;
      }

      toast.success('Account created. Check your email to verify it.');
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}&type=creator`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Could not create ambassador account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page byblos-light-page min-h-screen bg-[#090909] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            <div className="flex flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="rounded-xl px-3 py-2 text-sm text-white/75 transition-all duration-200 hover:bg-yellow-100 hover:text-black"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back</span>
              </Button>
            </div>

            <div className="absolute left-1/2 flex min-w-0 max-w-[46%] -translate-x-1/2 items-center justify-center text-center sm:max-w-[50%]">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Ambassador Portal</h1>
            </div>

            <div className="flex-1" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-5xl flex-col px-4 py-5 sm:min-h-[calc(100svh-5rem)]">
        <div className="grid flex-1 items-center gap-6 py-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-300">
            {token ? 'Ambassador invite' : 'Byblos ambassadors'}
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Earn when your audience buys safely.</h1>
          <p className="text-sm font-medium leading-6 text-white/55">
            {invite
              ? `${invite.shopName} invited you to sell through Byblos.`
              : 'Create an ambassador account, invite sellers with your link, and earn when their products sell.'}
          </p>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:grid-cols-2">
          <Input value={form.firstName} onChange={(e) => updateForm('firstName', e.target.value)} placeholder="First name" className="h-12 rounded-2xl border-white/10 bg-black/45" required />
          <Input value={form.lastName} onChange={(e) => updateForm('lastName', e.target.value)} placeholder="Last name" className="h-12 rounded-2xl border-white/10 bg-black/45" required />
          <Input
            value={form.email}
            readOnly={Boolean(token)}
            onChange={(e) => updateForm('email', e.target.value)}
            type="email"
            placeholder="Email"
            className="h-12 rounded-2xl border-white/10 bg-black/45 text-white/70 sm:col-span-2"
            required
          />
          <Input value={form.mpesaNumber} onChange={(e) => updateForm('mpesaNumber', e.target.value)} placeholder="M-Pesa number" className="h-12 rounded-2xl border-white/10 bg-black/45 sm:col-span-2" required />
          <Input value={form.whatsappNumber} onChange={(e) => updateForm('whatsappNumber', e.target.value)} placeholder="WhatsApp number" className="h-12 rounded-2xl border-white/10 bg-black/45 sm:col-span-2" required />
          <div className="relative sm:col-span-2">
            <Input value={form.password} onChange={(e) => updateForm('password', e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Password" className="h-12 rounded-2xl border-white/10 bg-black/45 pr-12" required />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative sm:col-span-2">
            <Input value={form.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm password" className="h-12 rounded-2xl border-white/10 bg-black/45 pr-12" required />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  { label: 'Upper and lowercase', met: passwordStrength.hasUpper && passwordStrength.hasLower },
                  { label: 'Passwords match', met: passwordsMatch }
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
            <Button disabled={loading || !passwordsMatch} className="h-12 rounded-2xl bg-yellow-400 font-black text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create ambassador account'}
            </Button>
            <Link to="/creator/login" className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-black text-white transition hover:bg-white/10">
              Ambassador login
            </Link>
          </div>
        </form>
        </div>
      </div>
    </main>
  );
}


