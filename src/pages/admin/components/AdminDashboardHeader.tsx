import { Shield } from 'lucide-react';

export function AdminDashboardHeader() {
  return (
    <header className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
      <div className="relative bg-[#0A0A0A]/60 backdrop-blur-3xl border border-white/10 rounded-3xl md:rounded-[2.5rem] p-5 md:p-10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="absolute -inset-2 bg-yellow-500/20 rounded-2xl blur opacity-50 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
              <Shield className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
              Admin <span className="text-yellow-500">Dashboard</span>
            </h1>
            <p className="text-gray-400 font-medium mt-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              System Operational - Welcome back, Administrator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
          <div className="px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-xl text-sm font-black border border-yellow-500/20 tracking-wider">
            ROOT ACCESS
          </div>
          <div className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm font-bold border border-white/10 italic">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );
}
