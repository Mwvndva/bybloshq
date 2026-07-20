import { Shield } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/NotificationBell';

export function AdminDashboardHeader() {
  return (
    <header className="relative group">
      <div className="relative bg-[#0A0A0A]/70 border border-white/10 rounded-3xl md:rounded-[2rem] p-5 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="relative w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20">
              <Shield className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Admin <span className="text-yellow-500">Dashboard</span>
            </h1>
            <p className="text-gray-400 font-medium mt-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              Welcome back, Administrator.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
          <NotificationBell />
          <div className="px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-xl text-sm font-semibold border border-yellow-500/20">
            Admin access
          </div>
          <div className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm font-semibold border border-white/10">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );
}


