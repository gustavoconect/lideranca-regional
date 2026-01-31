
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    LogOut,
    ClipboardList,
    TrendingUp,
    Target,
    Users,
    LayoutDashboard,
    Award,
    ChevronRight,
    Loader2
} from 'lucide-react'
import { motion } from 'framer-motion'

interface UnitMetrics {
    nps_score: number
    responses_count: number
    position_ranking: number
    goal_2026_1: number
    units: {
        name: string
        code: string
    }
}

export default function UnitDashboardPage() {
    const navigate = useNavigate()
    const [metrics, setMetrics] = useState<UnitMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [userName, setUserName] = useState('')

    useEffect(() => {
        fetchUnitData()
    }, [])

    const fetchUnitData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                navigate('/login')
                return
            }

            setUserName(user.user_metadata?.full_name || 'Líder')

            // Fetch metrics for the unit where this user is the leader
            const { data: unitData } = await supabase
                .from('units')
                .select('id, name')
                .eq('leader_id', user.id)
                .single()

            if (unitData) {
                const { data: npsData } = await supabase
                    .from('nps_metrics')
                    .select('*, units(name, code)')
                    .eq('unit_id', unitData.id)
                    .order('week_start_date', { ascending: false })
                    .limit(1)
                    .single()

                if (npsData) {
                    setMetrics(npsData as any)
                }
            }
        } catch (error) {
            console.error('Error fetching unit data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0F172A]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#0F172A] text-slate-200 pb-20">
            {/* Header Mobile-First */}
            <header className="p-6 pt-10 flex flex-col gap-2 bg-gradient-to-b from-slate-900 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
                            Unidade <span className="text-emerald-400">{metrics?.units?.name || '---'}</span>
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            Dashboard Operacional • Líder: {userName}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-white">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <main className="flex flex-1 flex-col gap-6 p-6">
                {/* Destaque Principal: Ranking & NPS */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="grid grid-cols-2 gap-4"
                >
                    <Card className="bg-emerald-500 border-none shadow-xl shadow-emerald-500/20 rounded-3xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <Award className="h-12 w-12 text-white" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-emerald-900/60">Posição Ranking</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-white italic">#{metrics?.position_ranking || '--'}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 shadow-xl rounded-3xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-slate-500">NPS Atual</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-4xl font-black italic ${metrics?.nps_score && metrics.nps_score >= metrics.goal_2026_1 ? 'text-emerald-400' : 'text-amber-500'}`}>
                                {metrics?.nps_score?.toFixed(1) || '--'}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Card de Meta Progressão */}
                <Card className="bg-slate-900/50 border-slate-800 rounded-3xl p-6 ring-1 ring-white/5 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                <Target className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Objetivo 2026</h3>
                        </div>
                        <Badge className="bg-indigo-500/20 text-indigo-400 border-none rounded-lg text-xs font-black">Meta: {metrics?.goal_2026_1 || 75}</Badge>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Progresso para a Meta</span>
                            <span className="text-xl font-black text-white">
                                {metrics ? ((metrics.nps_score / metrics.goal_2026_1) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                        <Progress value={metrics ? Math.min(100, (metrics.nps_score / metrics.goal_2026_1) * 100) : 0} className="h-2 bg-slate-800" />
                        <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
                            {metrics && metrics.nps_score >= metrics.goal_2026_1
                                ? "Sua unidade está operando ACIMA da meta regional. Mantenha a excelência!"
                                : "Aumente o contato com detratores para atingir o objetivo estratégico."}
                        </p>
                    </div>
                </Card>

                {/* Ações Rápidas */}
                <div className="grid gap-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Ações Operacionais</h3>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/tasks')}
                        className="flex items-center justify-between p-6 bg-amber-500 rounded-3xl text-slate-950 shadow-lg shadow-amber-500/10 transition-all font-black uppercase text-xs tracking-widest"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-slate-950/20 rounded-xl">
                                <ClipboardList className="h-6 w-6" />
                            </div>
                            <span>Minhas Tarefas</span>
                        </div>
                        <ChevronRight className="h-5 w-5" />
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/reports')}
                        className="flex items-center justify-between p-6 bg-slate-800 rounded-3xl text-white shadow-lg transition-all font-black uppercase text-xs tracking-widest"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/10 rounded-xl text-emerald-400">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                            <span>Relatório Unidade</span>
                        </div>
                        <ChevronRight className="h-5 w-5" />
                    </motion.button>
                </div>

                {/* Estatísticas da Amostra */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-2xl flex flex-col gap-1">
                        <Users className="h-4 w-4 text-slate-600 mb-1" />
                        <span className="text-[8px] font-black text-slate-500 uppercase">Total de Feedbacks</span>
                        <span className="text-lg font-black text-white">{metrics?.responses_count || 0}</span>
                    </div>
                    <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-2xl flex flex-col gap-1">
                        <Award className="h-4 w-4 text-emerald-500 mb-1" />
                        <span className="text-[8px] font-black text-slate-500 uppercase">Status Unidade</span>
                        <span className="text-lg font-black text-emerald-400">ELITE</span>
                    </div>
                </div>
            </main>

            {/* Bottom Nav Mobile */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 flex items-center justify-around px-6 z-50">
                <button onClick={() => navigate('/unit-dashboard')} className="flex flex-col items-center gap-1 text-emerald-500">
                    <LayoutDashboard className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Home</span>
                </button>
                <button onClick={() => navigate('/tasks')} className="flex flex-col items-center gap-1 text-slate-500">
                    <ClipboardList className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Tarefas</span>
                </button>
                <button onClick={() => navigate('/reports')} className="flex flex-col items-center gap-1 text-slate-500">
                    <TrendingUp className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Ranking</span>
                </button>
            </nav>
        </div>
    )
}
