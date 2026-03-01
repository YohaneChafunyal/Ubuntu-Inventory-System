import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  Package, DollarSign, AlertTriangle, Activity, 
  Search, RefreshCw, FileText, Mail, Download,
  Plus, Minus, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatBot } from './components/ChatBot';

// --- Types ---

interface Stats {
  total_in_value: number;
  total_out_value: number;
  active_items: number;
  low_stock_alerts: number;
}

interface StockItem {
  item_name: string;
  total_in_units: number;
  total_out_units: number;
  current_stock: number;
  fixed_value_remain: number;
  last_updated: string;
}

interface ChartData {
  movement: any[];
  itemDistribution: any[];
}

// --- Components ---

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="card flex items-start justify-between"
  >
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
      {trend && (
        <p className={`text-xs mt-2 font-medium ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend} from last month
        </p>
      )}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </motion.div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-bottom border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

interface Transaction {
  type: 'IN' | 'OUT';
  id: number;
  item_name: string;
  qty_units: number;
  qty_bucks: number;
  date: string;
  responsible_email: string;
  notes: string;
  department?: string;
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [granularity, setGranularity] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  
  const [isInModalOpen, setIsInModalOpen] = useState(false);
  const [isOutModalOpen, setIsOutModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const healthRes = await fetch('/api/health');
      console.log("Server health:", await healthRes.json());

      const queryParams = new URLSearchParams({
        search,
        startDate,
        endDate,
        granularity
      }).toString();

      const [statsRes, stocksRes, chartsRes, transRes] = await Promise.all([
        fetch(`/api/dashboard/stats`),
        fetch('/api/stock'),
        fetch(`/api/dashboard/charts?granularity=${granularity}`),
        fetch(`/api/transactions?${queryParams}`)
      ]);
      setStats(await statsRes.json());
      setStocks(await stocksRes.json());
      setCharts(await chartsRes.json());
      const transData = await transRes.json();
      setTransactions(Array.isArray(transData) ? transData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, startDate, endDate, granularity]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch('/api/inventory/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          qnty_per_raw: parseFloat(data.qnty_per_raw as string) || 0,
          total_qnty: parseFloat(data.total_qnty as string),
          unit_price: parseFloat(data.unit_price as string) || 0,
          total_amount: parseFloat(data.total_amount as string) || 0,
          fixed_value_remain: parseFloat(data.fixed_value_remain as string) || 5,
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        setIsInModalOpen(false);
        fetchData();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      showToast('Failed to save', 'error');
    }
  };

  const handleOutSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch('/api/inventory/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          qnty_taken_raw: parseFloat(data.qnty_taken_raw as string) || 0,
          total_qnty_taken: parseFloat(data.total_qnty_taken as string),
          qnty_added_in_raw: parseFloat(data.qnty_added_in_raw as string) || 0,
          qnty_added_in_bucks: parseFloat(data.qnty_added_in_bucks as string) || 0,
          bo_price_per_unit: parseFloat(data.bo_price_per_unit as string) || 0,
          total_price: parseFloat(data.total_price as string) || 0,
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message, 'success');
        setIsOutModalOpen(false);
        fetchData();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      showToast('Failed to save', 'error');
    }
  };

  const filteredStocks = stocks.filter(s => 
    s.item_name.toLowerCase().includes(search.toLowerCase())
  );

  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Inventory Manager</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsInModalOpen(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Record IN</span>
            </button>
            <button 
              onClick={() => setIsOutModalOpen(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Minus className="w-4 h-4" /> <span className="hidden sm:inline">Record OUT</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Purchase Value" 
            value={`MKW ${(stats?.total_in_value || 0).toLocaleString()}`} 
            icon={DollarSign} 
            color="bg-blue-600" 
          />
          <StatCard 
            title="Total Consumed Value" 
            value={`MKW ${(stats?.total_out_value || 0).toLocaleString()}`} 
            icon={Activity} 
            color="bg-rose-600" 
          />
          <StatCard 
            title="Active Inventory Items" 
            value={stats?.active_items || 0} 
            icon={Package} 
            color="bg-emerald-600" 
          />
          <StatCard 
            title="Low Stock Alerts" 
            value={stats?.low_stock_alerts || 0} 
            icon={AlertTriangle} 
            color="bg-amber-600" 
          />
        </div>

        {/* Filters & Actions */}
        <div className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search items or activities..." 
                className="input-field pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-200">
                <Filter className="w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  className="text-xs border-none focus:ring-0 p-1" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-slate-300">to</span>
                <input 
                  type="date" 
                  className="text-xs border-none focus:ring-0 p-1" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="Refresh">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Inventory Volume Trend</h3>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['weekly', 'monthly', 'yearly'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      granularity === g 
                        ? 'bg-white text-primary shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts?.movement || []}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Area type="monotone" dataKey="units_in" stroke="#2563EB" fillOpacity={1} fill="url(#colorIn)" name="Units In" strokeWidth={3} />
                  <Area type="monotone" dataKey="units_out" stroke="#EF4444" fillOpacity={1} fill="url(#colorOut)" name="Units Out" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold mb-6">Stock Distribution</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts?.itemDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(charts?.itemDistribution || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Material Analysis Table */}
        <div className="card mt-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Material & Event Analysis</h3>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4 text-right">Total In</th>
                  <th className="px-6 py-4 text-right">Total Out</th>
                  <th className="px-6 py-4 text-right">Stock Level</th>
                  <th className="px-6 py-4 text-right">Usage %</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocks.map((item) => {
                  const usagePercent = item.total_in_units > 0 
                    ? Math.round((item.total_out_units / item.total_in_units) * 100) 
                    : 0;
                  return (
                    <tr key={item.item_name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-700">{item.item_name}</td>
                      <td className="px-6 py-4 text-right font-mono">{item.total_in_units}</td>
                      <td className="px-6 py-4 text-right font-mono text-rose-600">{item.total_out_units}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold">{item.current_stock}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs">{usagePercent}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.current_stock <= item.fixed_value_remain ? (
                          <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">Low Stock</span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Healthy</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Material Movement Table */}
        <div className="card mt-8 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Material Movement History</h3>
            <div className="flex gap-2">
              <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">IN: {transactions.filter(t => t.type === 'IN').length}</span>
              <span className="text-xs text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">OUT: {transactions.filter(t => t.type === 'OUT').length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Dept/Supplier</th>
                  <th className="px-6 py-4 text-right">Qty</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Responsible</th>
                  <th className="px-6 py-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={`${t.type}-${t.id}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{t.item_name}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {t.department || '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">{t.qty_units}</td>
                    <td className="px-6 py-4 text-right font-mono">
                      {t.qty_bucks > 0 ? `MKW ${t.qty_bucks.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 truncate max-w-[150px]">{t.responsible_email}</td>
                    <td className="px-6 py-4 text-slate-400 italic truncate max-w-[200px]">{t.notes}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No transactions found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Inventory Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="card lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Live Inventory Status</h3>
              <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">Showing {filteredStocks.length} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                  <tr>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4 text-center">Stock</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStocks.map((item) => (
                    <tr key={item.item_name} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-slate-700">{item.item_name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-800">{item.current_stock}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.current_stock <= item.low_stock_threshold 
                            ? 'bg-rose-100 text-rose-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.current_stock <= item.low_stock_threshold ? 'Low Stock' : 'Healthy'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(item.last_updated).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card h-fit">
            <h3 className="text-lg font-bold mb-6">Material Analysis (%)</h3>
            <div className="space-y-4">
              {stocks.sort((a, b) => b.current_stock - a.current_stock).slice(0, 8).map((item, idx) => {
                const totalStock = stocks.reduce((acc, s) => acc + s.current_stock, 0);
                const percentage = totalStock > 0 ? (item.current_stock / totalStock) * 100 : 0;
                return (
                  <div key={item.item_name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{item.item_name}</span>
                      <span className="text-slate-500">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div 
                        className="h-1.5 rounded-full" 
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: COLORS[idx % COLORS.length]
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <ChatBot />

      {/* Modals */}
      <AnimatePresence>
        {isInModalOpen && (
          <Modal isOpen={isInModalOpen} onClose={() => setIsInModalOpen(false)} title="Record Material IN">
            <form onSubmit={handleInSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Material Name*</label>
                  <input name="material_name" required list="items-list" className="input-field" placeholder="e.g. Maize" />
                  <datalist id="items-list">
                    {stocks.map(s => <option key={s.item_name} value={s.item_name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Mode Of Need</label>
                  <select name="mode_of_need" className="input-field">
                    <option value="Monthly Purchase">Monthly Purchase</option>
                    <option value="Weekly Purchase">Weekly Purchase</option>
                    <option value="Daily Purchase">Daily Purchase</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="label">Quantity Type (Unit)*</label>
                  <input name="qnty_type" required className="input-field" placeholder="e.g. kg, liters, Basin" />
                </div>
                <div>
                  <label className="label">Qnty Per (kg/L/Bn)</label>
                  <input name="qnty_per_raw" type="number" step="0.01" className="input-field" placeholder="Total raw weight" />
                </div>
                <div>
                  <label className="label">Total Qnty (Units)*</label>
                  <input name="total_qnty" type="number" step="0.01" required className="input-field" placeholder="Number of units" />
                </div>
                <div>
                  <label className="label">Unit Price</label>
                  <input name="unit_price" type="number" step="0.01" className="input-field" placeholder="MKW 0.00" />
                </div>
                <div>
                  <label className="label">Total Amount (Bucks)*</label>
                  <input name="total_amount" type="number" step="0.01" required className="input-field" placeholder="MKW 0.00" />
                </div>
                <div>
                  <label className="label">Fixed Value Remain (Threshold)</label>
                  <input name="fixed_value_remain" type="number" step="0.01" className="input-field" placeholder="Low stock level" />
                </div>
                <div>
                  <label className="label">Date In*</label>
                  <input name="date_in" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="input-field" />
                </div>
                <div>
                  <label className="label">Responsible*</label>
                  <input name="responsible" required className="input-field" placeholder="Name or Email" />
                </div>
                <div>
                  <label className="label">Signed By</label>
                  <input name="signed_by" className="input-field" placeholder="Approver name" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Notes</label>
                  <textarea name="notes" className="input-field h-20" placeholder="Additional details..."></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsInModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                <button type="submit" className="btn-primary">Save Entry</button>
              </div>
            </form>
          </Modal>
        )}

        {isOutModalOpen && (
          <Modal isOpen={isOutModalOpen} onClose={() => setIsOutModalOpen(false)} title="Record Material OUT">
            <form onSubmit={handleOutSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Item Name*</label>
                  <select name="item_name" required className="input-field">
                    <option value="">Select Item</option>
                    {stocks.filter(s => s.current_stock > 0).map(s => (
                      <option key={s.item_name} value={s.item_name}>{s.item_name} ({s.current_stock} available)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Location Type*</label>
                  <select name="location_type" required className="input-field">
                    <option value="School">School</option>
                    <option value="Project">Project</option>
                    <option value="RCC Kitchen">RCC Kitchen</option>
                    <option value="Bought Outside">Bought Outside</option>
                    <option value="Project Store">Project Store</option>
                    <option value="From Garden">From Garden</option>
                  </select>
                </div>
                <div>
                  <label className="label">Department*</label>
                  <input name="department" required className="input-field" placeholder="e.g. Kitchen, Maintenance" />
                </div>
                <div>
                  <label className="label">Garden (if applicable)</label>
                  <input name="garden" className="input-field" placeholder="e.g. Garden 1" />
                </div>
                <div>
                  <label className="label">Unit Type*</label>
                  <input name="unit_type" required className="input-field" placeholder="e.g. kg, liters" />
                </div>
                <div>
                  <label className="label">Item Type</label>
                  <input name="item_type" className="input-field" placeholder="e.g. Garlic, Chinesse" />
                </div>
                <div>
                  <label className="label">Qnty Taken (Raw Weight)</label>
                  <input name="qnty_taken_raw" type="number" step="0.01" className="input-field" />
                </div>
                <div>
                  <label className="label">Total Qnty Taken (Units)*</label>
                  <input name="total_qnty_taken" type="number" step="0.01" required className="input-field" />
                </div>
                <div>
                  <label className="label">Qnty Added In (Raw)</label>
                  <input name="qnty_added_in_raw" type="number" step="0.01" className="input-field" />
                </div>
                <div>
                  <label className="label">Qnty Added In (Bucks)</label>
                  <input name="qnty_added_in_bucks" type="number" step="0.01" className="input-field" />
                </div>
                <div>
                  <label className="label">BO Price per unit</label>
                  <input name="bo_price_per_unit" type="number" step="0.01" className="input-field" />
                </div>
                <div>
                  <label className="label">Total Price</label>
                  <input name="total_price" type="number" step="0.01" className="input-field" />
                </div>
                <div>
                  <label className="label">Date Out*</label>
                  <input name="date_out" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="input-field" />
                </div>
                <div>
                  <label className="label">Authorized By</label>
                  <input name="auth_by" className="input-field" placeholder="Authorizer name" />
                </div>
                <div>
                  <label className="label">Responsible Email*</label>
                  <input 
                    name="responsible_email" 
                    type="email" 
                    required 
                    className="input-field" 
                    placeholder="email@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Comment</label>
                  <textarea name="comment" className="input-field h-20" placeholder="Any comments..."></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsOutModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                <button type="submit" className="btn-secondary">Issue Material</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[100] flex items-center gap-3 text-white font-medium ${
              toast.type === 'success' ? 'bg-emerald-500' : 
              toast.type === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
            }`}
          >
            {toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
