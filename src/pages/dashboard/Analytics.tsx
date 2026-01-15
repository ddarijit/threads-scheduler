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
    const [error, setError] = useState<string | null>(null);

    // 1. Fetch Connected Accounts
    useEffect(() => {
        if (user) {
            supabase.from('user_tokens').select('*').eq('user_id', user.id)
                .then(({ data }) => {
                    if (data && data.length > 0) {
                        setAccounts(data);
                        // Only set default if not already set (prevents reset on re-renders)
                        if (!selectedAccount) setSelectedAccount(data[0].threads_user_id);
                    }
                });
        }
    }, [user]);

    // 2. Fetch Analytics Data
    const fetchAnalytics = async () => {
        if (!selectedAccount) return;
        setLoading(true);
        setError(null);
        try {
            const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://threads-scheduler-backend.onrender.com' : 'http://localhost:3000');
            console.log('Fetching analytics from:', `${API_URL}/analytics/${selectedAccount}`);

            const res = await fetch(`${API_URL}/analytics/${selectedAccount}`);
            const text = await res.text();

            if (!res.ok) {
                // Try to parse error json
                try {
                    const errJson = JSON.parse(text);
                    throw new Error(errJson.error || `Server Error ${res.status}`);
                } catch (e) {
                    throw new Error(`Failed to fetch: ${res.status} ${text}`);
                }
            }

            const json = JSON.parse(text);
            setData(json);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
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

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl mb-8 flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-full">⚠️</div>
                    <div>
                        <div className="font-semibold">Failed to load analytics</div>
                        <div className="text-sm opacity-80">{error}</div>
                    </div>
                    <button onClick={fetchAnalytics} className="ml-auto px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition-colors">
                        Retry
                    </button>
                </div>
            )}

            {data && (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Connected Status Card */}
                        <div className="bg-white/10 border border-white/20 p-6 rounded-xl relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <RefreshCw size={64} />
                            </div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/20 text-purple-200">
                                    <Users size={24} />
                                </div>
                                <span className="text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-1 rounded-full">
                                    ACTIVE
                                </span>
                            </div>
                            <div className="text-2xl font-bold text-white mb-1 truncate">@{data.profile.username}</div>
                            <div className="text-sm text-gray-400">Connected Account</div>
                        </div>

                        <StatCard
                            label="Total Likes (Recent)"
                            value={data.current.total_likes}
                            icon={<Heart className="text-red-400" size={24} />}
                        />
                        <StatCard
                            label="Total Replies (Recent)"
                            value={data.current.total_replies}
                            icon={<MessageCircle className="text-blue-400" size={24} />}
                        />
                    </div>

                    {/* Chart Area */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-6">Follower Growth (30 Days)</h3>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            {data.history && data.history.length > 1 ? (
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
                            ) : (
                                <div className="text-center text-gray-500">
                                    <BarChartIcon size={48} className="mx-auto mb-3 opacity-20" />
                                    <p>Not enough data yet.</p>
                                    <p className="text-sm opacity-60">Check back tomorrow to see your growth trend!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, trend }: { label: string, value: number, icon: any, trend?: string }) => (
    <div className="bg-white/5 border border-white/10 p-6 rounded-xl hover:bg-white/10 transition-colors">
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
