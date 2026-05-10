import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description: string;
  trend: number | null;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const StatsCard = ({ title, value, icon, description, trend }: StatsCardProps) => (
  <div className="relative group">
    <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500/0 to-yellow-500/0 rounded-[2rem] blur opacity-0 group-hover:opacity-30 group-hover:from-yellow-500/50 group-hover:to-orange-500/50 transition duration-500" />

    <Card className="relative bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden transition-all duration-500 group-hover:bg-[#0A0A0A]/60 group-hover:scale-[1.02] group-hover:border-white/20">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
        <CardTitle className="text-sm font-semibold text-gray-400 tracking-wide uppercase">
          {title}
        </CardTitle>
        <div className="h-12 w-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-yellow-500 group-hover:scale-110 group-hover:text-yellow-400 transition-all duration-500 shadow-inner">
          {icon}
        </div>
      </CardHeader>

      <CardContent className="relative z-10 pt-0">
        <div className="text-3xl font-black text-white tracking-tight tabular-nums group-hover:text-yellow-50 transition-colors duration-500">
          {value}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {trend !== null && trend !== undefined && (
            <div className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${trend >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {trend >= 0 ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
              {Math.abs(trend)}%
            </div>
          )}
          <span className="text-xs text-gray-500 font-medium truncate">{description}</span>
        </div>
      </CardContent>
    </Card>
  </div>
);

export const ChartContainer = ({ title, description, children, className = '' }: { title: string, description: string, children: ReactNode, className?: string }) => (
  <Card className={`${className} bg-[#0A0A0A]/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden group hover:border-white/20 transition-all duration-500`}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
    <CardHeader className="relative z-10 pb-2">
      <CardTitle className="text-xl font-bold text-white group-hover:text-yellow-50 transition-colors">{title}</CardTitle>
      <CardDescription className="text-gray-400 font-medium">{description}</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10 h-[350px] w-full pt-4">
      {children}
    </CardContent>
  </Card>
);

export const UserGrowthChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="User Growth" description="New buyers and sellers growth trend" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <defs>
          <linearGradient id="colorBuyers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSellers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)', color: '#fff' }}
          itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
        />
        <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
        <Line type="monotone" dataKey="buyers" stroke="#06b6d4" strokeWidth={4} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#0A0A0A' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Buyers" />
        <Line type="monotone" dataKey="sellers" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#0A0A0A' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Sellers" />
      </LineChart>
    </ResponsiveContainer>
  </ChartContainer>
);

export const RevenueChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Revenue Trends" description="Monthly platform earnings (KSh)" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <Tooltip
          cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
          itemStyle={{ color: '#e5e7eb' }}
        />
        <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} name="Revenue (KSh)" barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
);

export const SalesChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Sales Volume" description="Total marketplace transaction volume" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <Tooltip
          cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
          itemStyle={{ color: '#e5e7eb' }}
        />
        <Bar dataKey="sales" fill="url(#colorSales)" radius={[8, 8, 0, 0]} name="Sales (KSh)" barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
);

export const ProductStatusChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Product Distribution" description="Inventory breakdown by status" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={110}
          paddingAngle={8}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </ChartContainer>
);

export const GeoDistributionChart = ({ data }: { data: any[] }) => (
  <ChartContainer title="Geographic Reach" description="Top 5 Areas by user density" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={110}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  </ChartContainer>
);
