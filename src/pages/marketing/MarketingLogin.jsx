import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { marketingApi } from '../../services/marketingApi'

export default function MarketingLogin() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

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
        <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 selection:bg-yellow-500/30">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-10">
                    <div className="inline-flex w-12 h-12 bg-yellow-500 rounded-xl items-center justify-center mb-4 shadow-lg shadow-yellow-500/20">
                        <span className="text-black font-black text-2xl">B</span>
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tighter">Byblos Intelligence</h1>
                    <p className="text-gray-500 mt-1 text-xs font-bold uppercase tracking-widest">Admin Access</p>
                </div>

                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    {/* Subtle Glow Effect */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/10 blur-[100px] rounded-full"></div>

                    <h2 className="text-lg font-bold text-white mb-6 relative z-10">Sign in</h2>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold flex items-center gap-3 relative z-10">
                            <span className="text-lg">⚠️</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Email address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="adminmarketing@bybloshq.space"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-gray-600 focus:outline-none
                           focus:border-yellow-500/50 focus:bg-white/10 transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-gray-600 focus:outline-none
                           focus:border-yellow-500/50 focus:bg-white/10 transition-all text-sm font-medium"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black
                         font-black py-3 rounded-xl transition-all shadow-lg shadow-yellow-500/10
                         disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm"
                        >
                            {loading ? 'Authenticating...' : 'Sign in to Dashboard'}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-8 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                    Secure Marketing Environment
                </p>
            </div>
        </div>
    )
}
