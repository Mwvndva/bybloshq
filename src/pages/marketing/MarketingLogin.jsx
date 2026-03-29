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
                <div className="text-center mb-10 group">
                    <div className="inline-flex w-16 h-16 md:w-20 md:h-20 bg-yellow-500 rounded-2xl md:rounded-[2rem] items-center justify-center mb-6 shadow-[0_20px_40px_rgba(234,179,8,0.15)] group-hover:scale-110 transition-transform duration-700">
                        <span className="text-black font-black text-3xl md:text-4xl">B</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">MARKETING<span className="text-yellow-500">.</span></h1>
                    <p className="text-gray-500 mt-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] opacity-60">Protocol Intelligence Access</p>
                </div>

                <div className="bg-[#0A0A0A]/40 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[3rem] p-6 md:p-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden group/card">
                    {/* Subtle Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none"></div>
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/[0.05] blur-[100px] rounded-full"></div>

                    <h2 className="text-lg font-black text-white mb-6 relative z-10 uppercase italic tracking-tight">Identity Verification</h2>

                    {error && (
                        <div className="mb-6 p-4 md:p-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                {error}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6 relative z-10">
                        <div className="space-y-2">
                            <label className="block text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1 opacity-60">Identification</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="INTEL_NODE@BYBLOS.HQ"
                                required
                                className="w-full h-12 md:h-14 bg-white/[0.03] border-white/10 rounded-xl md:rounded-2xl px-5 md:px-6
                           text-white placeholder-gray-700 focus:outline-none
                           focus:border-yellow-500/50 focus:bg-white/[0.08] transition-all text-sm md:text-base font-bold tracking-tight"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1 opacity-60">Secret Key</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                required
                                className="w-full h-12 md:h-14 bg-white/[0.03] border-white/10 rounded-xl md:rounded-2xl px-5 md:px-6
                           text-white placeholder-gray-700 focus:outline-none
                           focus:border-yellow-500/50 focus:bg-white/[0.08] transition-all text-sm md:text-base font-bold tracking-tight"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 md:h-14 bg-yellow-500 hover:bg-yellow-400 text-black
                         font-black rounded-xl md:rounded-2xl transition-all shadow-[0_20px_40px_rgba(234,179,8,0.15)] hover:shadow-[0_20px_60px_rgba(234,179,8,0.25)]
                         disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-[10px] md:text-xs uppercase tracking-[0.2em] transform active:scale-95 group-hover/card:translate-y-[-2px] duration-500"
                        >
                            {loading ? 'AUTHENTICATING...' : 'Establish Connection'}
                        </button>
                    </form>
                </div>

                <div className="text-center mt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                    <p className="text-gray-600 text-[9px] font-black uppercase tracking-[0.4em] opacity-40">
                        Encrypted Data Channel • Marketing Node Protocol
                    </p>
                </div>
            </div>
        </div>
    )
}
