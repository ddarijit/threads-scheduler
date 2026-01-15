import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart as BarChartIcon, Users, Heart, MessageCircle, RefreshCw } from 'lucide-react';

export const Analytics = () => {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    // 1. Fetch Connected Accounts
    useEffect(() => {
        if (user) {
            supabase.from('user_tokens').select('*').eq('user_id', user.id)
                .then(({ data }) => {
                    if (data && data.length > 0) {
                        setAccounts(data);
                        setSelectedAccount(data[0].threads_user_id);
                    }
                });
        }
    }, [user]);

    // 2. Fetch Analytics Data
    const fetchAnalytics = async () => {
        if (!selectedAccount) return;
        setLoading(true);
        try {
            const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://threads-scheduler-backend.onrender.com' : 'http://localhost:3000');
            const res = await fetch(`${API_URL}/analytics/${selectedAccount}`);
            if (!res.ok) throw new Error('Failed to fetch analytics');
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [selectedAccount]);

    if (!user) return null;

    return (
        <div className="p-6 max-w-6xl mx-auto animate-fade-in">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BarChartIcon className="text-purple-400" />
                        Analytics
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Track your growth and engagement</p>
                </div>

                <div className="flex items-center gap-3 bg-white/5 p-1 rounded-lg border border-white/10">
                    {accounts.length > 0 ? (
                        <select
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="bg-transparent text-sm text-white focus:outline-none px-3 py-1 cursor-pointer"
                        >
                            {accounts.map(acc => (
                                <option key={acc.threads_user_id} value={acc.threads_user_id} className="bg-gray-900">
                                    {acc.nickname || 'Threads User'}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-xs text-gray-500 px-3">No connected accounts</span>
                    )}
                    <button
                        onClick={fetchAnalytics}
                        disabled={loading || !selectedAccount}
                        className={`p-2 rounded-md hover:bg-white/10 transition-colors ${loading ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {loading && !data && (
                <div className="flex justify-center py-20">
                    <div className="text-gray-500 animate-pulse">Loading insights...</div>
                </div>
            )}

            {data && (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <StatCard
                            label="Total Followers"
                            value={data.current.followers_count}
                            icon={<Users className="text-blue-400" />}
                            trend="+2.5%" // Placeholder for MVP
                        />
                        <StatCard
                            label="Total Likes (Recent)"
                            value={data.current.total_likes}
                            icon={<Heart className="text-red-400" />}
                        />
                        <StatCard
                            label="Total Replies (Recent)"
                            value={data.current.total_replies}
                            icon={<MessageCircle className="text-green-400" />}
                        />
                    </div>

                    {/* Chart Area */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-6">Follower Growth (30 Days)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.history}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#6b7280"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => new Date(val).getDate().toString()}
                                    />
                                    <YAxis
                                        stroke="#6b7280"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        width={40}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="followers_count"
                                        stroke="#8b5cf6"
                                        strokeWidth={3}
                                        dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, trend }: { label: string, value: number, icon: any, trend?: string }) => (
    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-6 rounded-xl">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-white">
                {icon}
            </div>
            {trend && <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-full">{trend}</span>}
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value?.toLocaleString() || 0}</div>
        <div className="text-sm text-gray-400">{label}</div>
    </div>
);
