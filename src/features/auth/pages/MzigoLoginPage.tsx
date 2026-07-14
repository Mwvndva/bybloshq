import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Lock, Mail, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getLogisticsToken, loginLogisticsPartner } from '@/api/logistics';

const MzigoLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (getLogisticsToken()) {
      navigate('/mzigo/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await loginLogisticsPartner(email, password);
      navigate('/mzigo/dashboard', { replace: true });
    } catch (error) {
      toast.error('Login failed', {
        description: error?.response?.data?.message || error?.message || 'Check the Mzigo credentials and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page min-h-[100svh] overflow-x-hidden bg-[#f8f7f2] px-4 py-6 text-stone-950">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:text-stone-950"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <section className="mx-auto flex min-h-[calc(100svh-96px)] max-w-md items-start py-6 sm:items-center sm:py-0">
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_22px_60px_rgba(17,17,17,0.09)] md:p-8"
        >
          <div className="mb-8 text-center">
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-200 bg-yellow-100 text-black">
              <Truck size={28} className="text-yellow-600" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Mzigo Ego</h1>
            <p className="mt-2 text-sm text-stone-500">Door to door logistics dashboard.</p>
          </div>

          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-medium text-stone-700">Email</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15"
                placeholder="mzigo@example.com"
              />
            </div>
          </label>

          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-medium text-stone-700">Password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15"
                placeholder="Enter password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 text-sm font-semibold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default MzigoLoginPage;


