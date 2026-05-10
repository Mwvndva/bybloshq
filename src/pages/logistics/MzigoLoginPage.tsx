import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Lock, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getLogisticsToken, loginLogisticsPartner } from '@/api/logisticsApi';

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
    } catch (error: any) {
      toast.error('Login failed', {
        description: error?.response?.data?.message || error?.message || 'Check the Mzigo credentials and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white hover:text-black"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <section className="mx-auto flex min-h-[calc(100vh-96px)] max-w-md items-center">
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-2xl border border-white/15 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-yellow-300 text-black">
              <Truck size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-white">Mzigo Ego</h1>
              <p className="text-sm text-white/75">Door to door logistics dashboard</p>
            </div>
          </div>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-white">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/45 focus:border-yellow-300"
              placeholder="mzigo@example.com"
            />
          </label>

          <label className="mb-6 block">
            <span className="mb-2 block text-sm text-white">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/45 focus:border-yellow-300"
              placeholder="Enter password"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-300 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Lock size={16} />
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default MzigoLoginPage;
