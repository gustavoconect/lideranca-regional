import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { WeeklyComparisonTable } from '@/components/charts/weekly-comparison-table'
import { NpsEvolutionChart } from '@/components/charts/nps-evolution-chart'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LogOut, RefreshCw, ClipboardList, BarChart3, MonitorPlay, Minimize2, TrendingDown, Target, Users, FileText, Database, ShieldAlert, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Metric {
    id: string
    nps_score: number
    promoters_count: number
    detractors_count: number
    goal_2026_1: number
    responses_count: number
    position_ranking: number
    week_start_date: string
    units: {
        name: string
        code: string
    }
}

export default function DashboardPage() {
    const navigate = useNavigate()
    const [metrics, setMetrics] = useState<Metric[]>([])
    const [allMetrics, setAllMetrics] = useState<Metric[]>([])
    const [availableWeeks, setAvailableWeeks] = useState<string[]>([])
    const [selectedWeek, setSelectedWeek] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [presentationMode, setPresentationMode] = useState(false)
    const [presentationSlide, setPresentationSlide] = useState(0)
    const [complianceRate, setComplianceRate] = useState(0)
    const [auditPendingCount, setAuditPendingCount] = useState(0)
    const [criticalTasks, setCriticalTasks] = useState<any[]>([])

    useEffect(() => {
        checkAuth()
        fetchAllMetrics()
        fetchOperationalCompliance()
    }, [])

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            navigate('/login')
        }
    }

    const fetchOperationalCompliance = async () => {
        try {
            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('status')

            if (error) throw error

            if (tasks && tasks.length > 0) {
                const verified = tasks.filter(t => t.status === 'verified').length
                const completed = tasks.filter(t => t.status === 'completed').length
                const total = tasks.length
                setComplianceRate((verified / total) * 100)
                setAuditPendingCount(completed)

                const { data: critical } = await supabase
                    .from('tasks')
                    .select('*, profiles!tasks_unit_leader_id_fkey(full_name)')
                    .eq('status', 'pending')
                    .eq('priority', 'critical')
                    .limit(5)

                setCriticalTasks(critical || [])
            }
        } catch (error) {
            console.error('Error fetching compliance:', error)
        }
    }

    const fetchAllMetrics = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('nps_metrics')
                .select(`
                    *,
                    units (
                        name,
                        code
                    )
                `)
                .order('week_start_date', { ascending: false })
                .order('nps_score', { ascending: false })

            if (error) throw error

            const metricsData = (data || []) as Metric[]
            setAllMetrics(metricsData)

            const weeks = [...new Set(metricsData.map(m => m.week_start_date))].sort().reverse()
            setAvailableWeeks(weeks)

            if (weeks.length > 0 && !selectedWeek) {
                setSelectedWeek(weeks[0])
            }

            const currentWeekWeek = selectedWeek || weeks[0]
            const currentWeekMetrics = metricsData.filter(m => m.week_start_date === currentWeekWeek)
            setMetrics(currentWeekMetrics)

        } catch (error) {
            console.error('Error fetching metrics:', error)
        } finally {
            setLoading(false)
        }
    }, [selectedWeek])

    useEffect(() => {
        if (selectedWeek && allMetrics.length > 0) {
            const currentWeekMetrics = allMetrics.filter(m => m.week_start_date === selectedWeek)
            setMetrics(currentWeekMetrics)
        }
    }, [selectedWeek, allMetrics])

    const getPreviousWeekMetrics = () => {
        const currentIndex = availableWeeks.indexOf(selectedWeek)
        if (currentIndex < availableWeeks.length - 1) {
            const previousWeek = availableWeeks[currentIndex + 1]
            return allMetrics.filter(m => m.week_start_date === previousWeek)
        }
        return []
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const formatWeekDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className={`flex min-h-screen w-full font-sans transition-colors duration-700 ${presentationMode ? 'bg-[#020617]' : 'bg-slate-50/50'}`}>
            {!presentationMode && (
                <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-white lg:block shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                    <div className="flex h-full flex-col gap-2 p-6">
                        <div className="flex items-center gap-2 px-2 pb-8">
                            <motion.div
                                initial={{ rotate: -10, scale: 0.9 }}
                                animate={{ rotate: 0, scale: 1 }}
                                className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"
                            >
                                <BarChart3 className="h-6 w-6 text-emerald-400" />
                            </motion.div>
                            <div className="flex flex-col">
                                <span className="text-lg font-black tracking-tighter text-slate-900 border-none leading-none">SP15<span className="text-emerald-500"> App</span></span>
                                <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] mt-1 uppercase">Executive Hub</span>
                            </div>
                        </div>

                        <nav className="flex-1 space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Monitoramento</p>
                            <Button variant="secondary" className="w-full justify-start gap-3 bg-slate-900 text-white hover:bg-slate-800 border-none shadow-md shadow-slate-200">
                                <BarChart3 className="h-4 w-4 text-emerald-400" /> Visão Geral
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-none transition-all" onClick={() => navigate('/tasks')}>
                                <ClipboardList className="h-4 w-4" /> Gestão de Tarefas
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-none transition-all" onClick={() => navigate('/reports')}>
                                <FileText className="h-4 w-4" /> Relatórios / Insights
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-none transition-all" onClick={() => navigate('/data-center')}>
                                <Database className="h-4 w-4" /> Centro de Dados
                            </Button>
                        </nav>

                        <div className="mt-auto border-t border-slate-100 pt-4">
                            <div className="px-3 py-4 mb-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Sistema</p>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-slate-600">Sync Ativo via Cloud</span>
                                </div>
                            </div>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 border-none" onClick={handleLogout}>
                                <LogOut className="h-4 w-4" /> Finalizar Sessão
                            </Button>
                        </div>
                    </div>
                </aside>
            )}

            <div className={`flex flex-col w-full min-h-screen transition-all duration-700 ${!presentationMode ? 'lg:pl-64' : ''}`}>
                <header className={`sticky top-0 z-30 flex h-20 items-center gap-4 px-4 md:px-8 border-b transition-all duration-700 ${presentationMode ? 'bg-slate-950/80 border-slate-800 text-white backdrop-blur-xl' : 'bg-white/80 border-slate-100 backdrop-blur-md'}`}>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tight md:text-2xl uppercase italic">
                            {presentationMode ? 'SP15 STRATEGIC HUB' : 'SP15 • Dashboard Executivo'}
                        </h1>
                        <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${presentationMode ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {presentationMode ? 'NPS ANALYTICS ENGINE V.2' : 'Resumo Semanal de Unidades'}
                        </p>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        {availableWeeks.length > 0 && (
                            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger className={`w-[200px] h-11 border-none font-bold rounded-xl transition-all ${presentationMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}>
                                    <SelectValue placeholder="Selecione a Semana" />
                                </SelectTrigger>
                                <SelectContent className={presentationMode ? 'bg-slate-900 border-slate-800 text-white' : ''}>
                                    {availableWeeks.map(week => (
                                        <SelectItem key={week} value={week} className="font-medium">
                                            {formatWeekDate(week)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block" />

                        <Button
                            variant={presentationMode ? "outline" : "ghost"}
                            size="sm"
                            className={`gap-2 h-11 px-5 rounded-xl transition-all duration-500 font-bold uppercase text-[10px] tracking-widest ${presentationMode ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                            onClick={() => setPresentationMode(!presentationMode)}
                        >
                            {presentationMode ? <Minimize2 className="h-4 w-4" /> : <MonitorPlay className="h-4 w-4" />}
                            <span className="hidden sm:inline">{presentationMode ? 'Dash Normal' : 'Modo Reunião'}</span>
                        </Button>

                        {!presentationMode && (
                            <Button variant="ghost" size="icon" onClick={fetchAllMetrics} className="h-11 w-11 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 border-none transition-all">
                                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        )}
                    </div>
                </header>

                <main className={`flex flex-1 flex-col gap-8 p-4 md:gap-10 md:p-10 transition-colors duration-700 ${presentationMode ? 'bg-[#020617]' : ''}`}>
                    <AnimatePresence mode="wait">
                        {(!presentationMode || presentationSlide === 0) ? (
                            <motion.div
                                key="dashboard-main"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                                    {[
                                        { title: 'NPS Regional', value: (metrics.reduce((acc, curr) => acc + curr.nps_score, 0) / (metrics.length || 1)).toFixed(1), icon: Target, color: 'emerald', meta: 'META 2026: 75.0', trend: 2.1 },
                                        { title: 'Amostragem', value: metrics.reduce((acc, curr) => acc + curr.responses_count, 0), icon: Users, color: 'navy', meta: 'Feedbacks processados', trend: 12 },
                                        { title: 'Compliance', value: complianceRate.toFixed(1) + '%', icon: ShieldAlert, color: 'emerald', meta: `${auditPendingCount} aguardando auditoria`, trend: 0 },
                                        { title: 'Risco Operacional', value: metrics.filter(m => m.nps_score < 50).length, icon: TrendingDown, color: 'amber', meta: 'Unidades em Risco', trend: -1 },
                                    ].map((card, idx) => (
                                        <motion.div
                                            key={card.title}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.1, duration: 0.5 }}
                                        >
                                            <Card className={`decision-card h-full ring-1 ${presentationMode ? 'bg-slate-900/30 ring-white/5 shadow-2xl' : 'bg-white ring-slate-200/60 shadow-xl'}`}>
                                                <div className={`absolute top-0 right-0 p-4 opacity-10`}>
                                                    <card.icon className="h-16 w-16" />
                                                </div>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className={`text-[10px] font-black uppercase tracking-[0.2em] ${presentationMode ? 'text-slate-500' : 'text-slate-400'}`}>{card.title}</CardTitle>
                                                    <div className={`p-1.5 rounded-lg ${presentationMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                                        <card.icon className={`h-3.5 w-3.5 ${card.color === 'emerald' ? 'text-emerald-500' : card.color === 'amber' ? 'text-amber-500' : 'text-slate-600'}`} />
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="flex items-baseline gap-2">
                                                        <div className={`text-5xl font-black tracking-tighter ${presentationMode ? 'text-white' : 'text-slate-900'}`}>
                                                            {card.value}
                                                        </div>
                                                        {card.trend !== 0 && (
                                                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${card.trend > 0 ? (presentationMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (presentationMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600')}`}>
                                                                {card.trend > 0 ? '+' : ''}{card.trend}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-4 flex flex-col gap-1">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${presentationMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                                            {card.meta}
                                                        </span>
                                                        <div className={`h-1 w-full rounded-full ${presentationMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: card.title === 'NPS Regional' ? `${Math.min(100, (Number(card.value) / 75) * 100)}%` : card.title === 'Compliance' ? `${complianceRate}%` : '100%' }}
                                                                className={`h-full rounded-full ${card.color === 'emerald' ? 'bg-emerald-500' : card.color === 'amber' ? 'text-amber-500' : 'bg-slate-600'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="grid gap-8 lg:grid-cols-3">
                                    <div className="lg:col-span-2 rounded-[2rem] overflow-hidden shadow-2xl ring-1 bg-white/5 bg-slate-900/40 ring-white/5 p-1">
                                        <div className="p-2">
                                            <WeeklyComparisonTable
                                                currentMetrics={metrics}
                                                previousMetrics={getPreviousWeekMetrics()}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-8">
                                        {!presentationMode ? (
                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between px-2">
                                                        <div className="flex flex-col">
                                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Ranking de Performance</h3>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Unidades da Semana</p>
                                                        </div>
                                                        <Badge className="bg-emerald-500 text-white border-none rounded-lg text-[10px] font-black italic">TOP 1: {metrics[0]?.units?.name}</Badge>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {metrics.slice(0, 5).map((metric, idx) => (
                                                            <div key={metric.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between hover:shadow-md transition-all">
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-lg font-black text-slate-300 italic">#0{idx + 1}</span>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-black text-slate-900 uppercase">{metric.units?.name}</span>
                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{metric.units?.code}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end">
                                                                    <span className={`text-sm font-black ${metric.nps_score >= (metric.goal_2026_1 || 75) ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                        {metric.nps_score.toFixed(1)}
                                                                    </span>
                                                                    <Progress value={Math.min(100, (metric.nps_score / 100) * 100)} className="h-1 w-16 bg-slate-100" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-[2rem] p-10 bg-slate-900/40 ring-1 ring-white/10 flex flex-col justify-center relative overflow-hidden h-full">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px]" />
                                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 blur-[60px]" />

                                                <div className="space-y-6 relative z-10">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-1 w-12 bg-emerald-500 rounded-full" />
                                                        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                                                            Strategic Insights
                                                        </h3>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <p className="text-2xl font-bold text-slate-100 leading-tight tracking-tight">
                                                            Aumento de <span className="text-emerald-400">+{metrics.reduce((acc, curr) => acc + curr.responses_count, 0)}</span> feedbacks críticos nesta rodada.
                                                        </p>
                                                        <p className="text-slate-400 text-sm leading-relaxed">
                                                            A unidade <span className="text-white font-bold">{metrics.sort((a, b) => b.nps_score - a.nps_score)[0]?.units?.name}</span> lidera a rede, superando a meta em <span className="text-emerald-400 font-bold">{(Number(metrics.sort((a, b) => b.nps_score - a.nps_score)[0]?.nps_score || 0) - (metrics.sort((a, b) => b.nps_score - a.nps_score)[0]?.goal_2026_1 || 0)).toFixed(1)}%</span>.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="dashboard-critical-tasks"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="space-y-12 max-w-5xl mx-auto py-12"
                            >
                                <div className="space-y-2">
                                    <Badge className="bg-emerald-500 text-slate-950 font-black px-4 py-1.5 rounded-full text-xs uppercase italic tracking-tighter">Strategic Execution Slide</Badge>
                                    <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Diretrizes Críticas <br /><span className="text-emerald-500">da Semana</span></h2>
                                    <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-sm">Monitoramento de execução tática • Ponto de atenção na reunião</p>
                                </div>

                                <div className="grid gap-6">
                                    {criticalTasks.length > 0 ? (
                                        criticalTasks.map((task, idx) => (
                                            <motion.div
                                                key={task.id}
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className="p-10 rounded-[3rem] bg-slate-900/40 border border-white/5 ring-1 ring-white/5 flex items-center justify-between"
                                            >
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-4">
                                                        <Badge className="bg-red-500 text-white border-none text-[10px] font-black italic">CRITICAL</Badge>
                                                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Responsável: {task.profiles?.full_name || 'Global'}</span>
                                                    </div>
                                                    <h3 className="text-3xl font-black text-white italic uppercase tracking-tight">{task.title}</h3>
                                                    <p className="text-slate-400 text-lg max-w-xl">{task.description}</p>
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="h-20 w-20 rounded-full border-4 border-slate-800 flex items-center justify-center relative overflow-hidden">
                                                        <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
                                                        <span className="text-red-500 font-black text-xl italic">!</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">PENDING ATTENTION</span>
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="p-20 rounded-[3rem] bg-slate-900/20 border border-white/5 flex flex-col items-center justify-center text-center">
                                            <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-500">
                                                <CheckCircle className="h-12 w-12" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white italic uppercase mb-2">Sem Diretrizes Críticas Pendentes</h3>
                                            <p className="text-slate-400 font-medium uppercase tracking-[0.2em] text-xs">A rede está operando em conformidade tática</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {presentationMode && (
                        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
                            <Button
                                variant="ghost"
                                onClick={() => setPresentationSlide(0)}
                                className={`h-12 w-12 rounded-full border border-white/10 ${presentationSlide === 0 ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'bg-slate-900/50 text-white'}`}
                            >
                                1
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setPresentationSlide(1)}
                                className={`h-12 w-12 rounded-full border border-white/10 ${presentationSlide === 1 ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'bg-slate-900/50 text-white'}`}
                            >
                                2
                            </Button>
                            <div className="h-10 w-[1px] bg-white/10 mx-2" />
                            <Button
                                variant="outline"
                                onClick={() => setPresentationMode(false)}
                                className="bg-slate-900/80 border-slate-700 text-white h-12 px-6 rounded-full font-black uppercase text-[10px] tracking-widest"
                            >
                                Sair do Modo SP15 Hub
                            </Button>
                        </div>
                    )}

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className={`rounded-[2rem] p-8 md:p-10 shadow-2xl ring-1 ${presentationMode ? 'bg-slate-900/40 ring-white/5' : 'bg-white ring-slate-200/60'}`}
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex flex-col gap-1">
                                <h3 className={`font-black tracking-tighter uppercase italic ${presentationMode ? 'text-white text-2xl' : 'text-xl'}`}>Curva de Performance Regional</h3>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${presentationMode ? 'text-slate-500' : 'text-slate-400'}`}>Série Histórica Consolidada 2026</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                                    <span className={`text-[10px] font-bold uppercase ${presentationMode ? 'text-slate-400' : 'text-slate-500'}`}>Média Rede</span>
                                </div>
                                <Badge variant="outline" className={`rounded-lg px-3 py-1 font-bold ${presentationMode ? 'border-slate-800 text-slate-500' : 'border-slate-100'}`}>Live Update</Badge>
                            </div>
                        </div>
                        <div className="h-[400px]">
                            <NpsEvolutionChart metrics={allMetrics} />
                        </div>
                    </motion.div>
                </main>

                <footer className={`h-16 flex items-center px-10 text-[9px] font-bold uppercase tracking-[0.3em] transition-colors duration-700 ${presentationMode ? 'bg-slate-950 text-slate-600' : 'bg-white text-slate-400 border-t'}`}>
                    <span>Executive Dashboard • build v2.1.0-elite</span>
                    <span className="ml-auto opacity-50">Authorized Use Only</span>
                </footer>
            </div>
        </div>
    )
}
