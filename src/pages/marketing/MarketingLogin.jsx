import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Loader2, Lock, Mail } from 'lucide-react'
import { marketingApi } from '../../services/marketingApi'
import { getFreshCsrfToken } from '@/lib/apiClient'

export default function MarketingLogin() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        getFreshCsrfToken();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await marketingApi.login(email, password)
            const { token, user } = res.data.data

            sessionStorage.setItem('marketing_token', token)
            sessionStorage.setItem('marketing_user', JSON.stringify(user))
            navigate('/admin/marketing')
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid email or password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-[100svh] items-start justify-center overflow-x-hidden bg-[#f8f7f2] px-4 py-6 text-stone-950 sm:items-center sm:py-8">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-200 bg-yellow-100 text-black">
                        <BarChart3 className="h-8 w-8 text-yellow-600" />
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Marketing Access</h1>
                    <p className="mt-2 text-sm text-stone-500">Sign in to review Byblos growth and acquisition.</p>
                </div>

                <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_22px_60px_rgba(17,17,17,0.09)] md:p-8">
                    {error && (
                        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-medium text-stone-700">Email</label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="marketing@byblos.hq"
                                    required
                                    autoComplete="email"
                                    className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-sm font-medium text-stone-700">Password</label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    required
                                    autoComplete="current-password"
                                    className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-yellow-400 px-4 text-sm font-semibold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-6 text-center text-xs text-stone-500">
                    Protected access for Byblos marketing teams.
                </p>
            </div>
        </div>
    )
}
