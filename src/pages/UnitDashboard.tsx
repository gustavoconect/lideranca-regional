
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
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
    Loader2,
    TrendingDown,
    ShieldAlert,
    MessageSquare,
    Calculator,
    History,
    FileText,
    Calendar
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'

interface UnitMetrics {
    id: string
    nps_score: number
    responses_count: number
    unit_id: string
    position_ranking: number
    goal_2026_1: number
    week_start_date: string
    units: {
        name: string
        code: string
    }
}

interface QualitativeReport {
    id: string
    report_date: string
    ai_summary: {
        type: 'unit' | 'regional'
        markdown_report?: string
        priority_level?: string
        feedback_count?: number
        nps_score?: number
        report_depth?: string
    }
}

export default function UnitDashboardPage() {
    const navigate = useNavigate()
    const [metrics, setMetrics] = useState<UnitMetrics | null>(null)
    const [previousMetrics, setPreviousMetrics] = useState<UnitMetrics | null>(null)
    const [latestReport, setLatestReport] = useState<QualitativeReport | null>(null)
    const [unitReports, setUnitReports] = useState<QualitativeReport[]>([])
    const [loading, setLoading] = useState(true)
    const [userName, setUserName] = useState('')
    const [rankingPosition, setRankingPosition] = useState<number | null>(null)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [isRankingOpen, setIsRankingOpen] = useState(false)
    const [selectedHistoryReport, setSelectedHistoryReport] = useState<QualitativeReport | null>(null)
    const [rankingList, setRankingList] = useState<any[]>([])

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
                // 1. Fetch metrics for THIS unit (current and previous)
                const { data: npsHistory } = await supabase
                    .from('nps_metrics')
                    .select('*, units(name, code)')
                    .eq('unit_id', unitData.id)
                    .order('week_start_date', { ascending: false })
                    .limit(2)

                if (npsHistory && npsHistory.length > 0) {
                    setMetrics(npsHistory[0] as any)
                    if (npsHistory.length > 1) {
                        setPreviousMetrics(npsHistory[1] as any)
                    }

                    // 2. Calculate Real-time Ranking
                    // Fetch latest metrics for ALL units to sort and find position
                    const { data: allUnitsMetrics } = await supabase
                        .from('nps_metrics')
                        .select('unit_id, nps_score, week_start_date')
                        // Optimization: You might want to filter by the latest week available in the system
                        // but for now, let's just get everything and filter in JS or deeper query if needed.
                        // A better approach for scalability: get distinct on unit_id ordered by date desc
                        .order('week_start_date', { ascending: false })
                        .order('nps_score', { ascending: false })

                    if (allUnitsMetrics) {
                        // Simple logic: Get latest metric for each unit
                        const latestMetricsMap = new Map();
                        allUnitsMetrics.forEach((m: any) => {
                            if (!latestMetricsMap.has(m.unit_id)) {
                                latestMetricsMap.set(m.unit_id, m);
                            }
                        });

                        const sortedMetrics = Array.from(latestMetricsMap.values())
                            .sort((a: any, b: any) => b.nps_score - a.nps_score);

                        const position = sortedMetrics.findIndex((m: any) => m.unit_id === unitData.id) + 1;
                        setRankingPosition(position);

                        // Prepare Ranking List for Modal
                        const rankedListWithDetails = await Promise.all(sortedMetrics.map(async (m: any, index: number) => {
                            const { data: u } = await supabase.from('units').select('name, code').eq('id', m.unit_id).single();
                            return {
                                ...m,
                                rank: index + 1,
                                unit_name: u?.name || 'Unknown',
                                unit_code: u?.code || '---'
                            };
                        }));
                        setRankingList(rankedListWithDetails);
                    }
                }

                // 3. Fetch ALL qualitative reports for history
                const { data: reportsData } = await supabase
                    .from('qualitative_reports')
                    .select('*')
                    .eq('unit_id', unitData.id)
                    .order('report_date', { ascending: false })

                if (reportsData && reportsData.length > 0) {
                    setUnitReports(reportsData as any)
                    setLatestReport(reportsData[0] as any)
                }
            }
        } catch (error) {
            console.error('Error fetching unit data:', error)
            toast.error("Erro ao carregar dados da unidade. Tente recarregar a página.")
        } finally {
            setLoading(false)
        }
    }

    // Promoters Needed Calculator
    const promotersNeeded = useMemo(() => {
        if (!metrics) return 0;
        const target = metrics.goal_2026_1 || 75;
        const currentNps = metrics.nps_score;
        if (currentNps >= target) return 0;

        // Formula approximation: How many consecutive 10s (Promoters) needed to reach target?
        // Current NPS = (P - D) / Total * 100
        // New NPS = ((P + x) - D) / (Total + x) * 100 = Target
        // 100(P + x - D) = Target(Total + x)
        // 100P + 100x - 100D = Target*Total + Target*x
        // 100x - Target*x = Target*Total - 100P + 100D
        // x(100 - Target) = Target*Total - 100(P-D)
        // x = (Target*Total - 100(P-D)) / (100 - Target)

        // However, we often don't have exact P and D counts in the minimal metrics object, 
        // assuming standard dist if missing or strictly using nps_score.
        // Let's use the exact formula if we had breakdowns, but here we can iterate or use the algebraic solution
        // assuming we know Total Responses.

        // NPS = (Promoters - Detractors) / Total * 100
        // We know NPS and Total. 
        // Let's simplify: We need to pull the average up.

        // Using the algebraic solution derived above:
        // x = (Target * Total - CurrentNPS * Total) / (100 - Target)  <-- Simplified because 100(P-D) is CurrentNPS * Total

        const total = metrics.responses_count || 50; // default to 50 if 0 to avoid Infinity issues
        const needed = (target * total - currentNps * total) / (100 - target);

        return Math.ceil(needed);
    }, [metrics]);

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground pb-20">
            {/* Header Mobile-First */}
            <header className="p-6 pt-10 flex flex-col gap-2 bg-gradient-to-b from-background to-transparent border-b border-border/10">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black tracking-tight text-foreground uppercase italic leading-none">
                            SmartFit <span className="text-primary italic">SP15</span>
                        </h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
                            {metrics?.units?.name} • Líder: {userName}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
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
                    <Card className="bg-primary border-none shadow-xl shadow-primary/20 rounded-3xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <Award className="h-12 w-12 text-black" />
                        </div>
                        <CardHeader className="pb-1">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-black/60">Posição Regional</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <div className="text-4xl font-black text-black italic">#{rankingPosition || '--'}</div>
                                {rankingPosition && metrics && previousMetrics && (
                                    <div className={`flex items-center text-[10px] font-bold ${rankingPosition < previousMetrics.position_ranking ? 'text-black' : 'text-black/40'}`}>
                                        {/* Lower rank number is better */}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border shadow-xl rounded-3xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">NPS Real-Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <div className={`text-4xl font-black italic ${metrics?.nps_score && metrics.nps_score >= (metrics.goal_2026_1 || 75) ? 'text-primary' : 'text-foreground'}`}>
                                    {metrics?.nps_score?.toFixed(1) || '--'}
                                </div>
                                {metrics && previousMetrics && (
                                    <div className={`flex items-center text-[10px] font-bold ${metrics.nps_score > previousMetrics.nps_score ? 'text-emerald-500' : metrics.nps_score < previousMetrics.nps_score ? 'text-red-500' : 'text-muted-foreground'}`}>
                                        {metrics.nps_score > previousMetrics.nps_score ? <TrendingUp className="h-3 w-3 mr-0.5" /> : metrics.nps_score < previousMetrics.nps_score ? <TrendingDown className="h-3 w-3 mr-0.5" /> : null}
                                        {Math.abs(metrics.nps_score - previousMetrics.nps_score).toFixed(1)}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Card de Meta Progressão */}
                <Card className="bg-card border-border rounded-3xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Target className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground italic">Objetivo SP15</h3>
                        </div>
                        <Badge className="bg-primary/20 text-primary border-none rounded-lg text-xs font-black">Meta: {metrics?.goal_2026_1 || 75}</Badge>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progresso para a Meta</span>
                            <span className="text-xl font-black text-foreground">
                                {metrics ? ((metrics.nps_score / metrics.goal_2026_1) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                        <Progress value={metrics ? Math.min(100, (metrics.nps_score / metrics.goal_2026_1) * 100) : 0} className="h-2 bg-muted" />
                        <p className="text-[9px] text-muted-foreground font-medium leading-relaxed">
                            {metrics && metrics.nps_score >= metrics.goal_2026_1
                                ? "Sua unidade está operando ACIMA da meta regional. Mantenha a excelência!"
                                : (
                                    <span className="flex items-center gap-1.5 text-amber-500 font-bold bg-amber-500/10 p-2 rounded-lg mt-2">
                                        <Calculator className="h-3 w-3" />
                                        Você precisa de ~{promotersNeeded} promotores consecutivos para atingir a meta.
                                    </span>
                                )}
                        </p>
                    </div>
                </Card>

                {/* Insight do Último Dossiê IA */}
                {latestReport && (
                    <Card className="bg-slate-900 border-none rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                            <ShieldAlert className="h-20 w-20 text-sky-400" />
                        </div>
                        <div className="flex flex-col gap-4 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                                        <MessageSquare className="h-4 w-4" />
                                    </div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-sky-400">Insight do Dossiê IA</h4>
                                </div>
                                <Badge className={`text-[8px] font-black uppercase tracking-widest border-none ${latestReport.ai_summary.priority_level === 'alta' ? 'bg-red-500 text-white' :
                                    latestReport.ai_summary.priority_level === 'média' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                                    }`}>
                                    Risco: {latestReport.ai_summary.priority_level || 'Normal'}
                                </Badge>
                            </div>

                            <p className="text-xs text-slate-300 font-medium leading-relaxed italic">
                                "{latestReport.ai_summary.markdown_report?.split('\n').find(l => l.length > 20)?.replace(/[#*]/g, '').trim().substring(0, 160)}..."
                            </p>

                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSelectedHistoryReport(latestReport);
                                    setIsHistoryOpen(true);
                                }}
                                className="w-fit h-7 px-3 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest gap-2"
                            >
                                Ler Análise Completa <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Ações Rápidas */}
                <div className="grid gap-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-2">Ferramentas de Gestão</h3>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/tasks')}
                        className="flex items-center justify-between p-6 bg-primary rounded-3xl text-black shadow-lg shadow-primary/10 transition-all font-black uppercase text-xs tracking-widest"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-black/10 rounded-xl">
                                <ClipboardList className="h-6 w-6" />
                            </div>
                            <span>Plano de Ação (Tasks)</span>
                        </div>
                        <ChevronRight className="h-5 w-5" />
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsHistoryOpen(true)}
                        className="flex items-center justify-between p-6 bg-card border border-border rounded-3xl text-foreground shadow-lg transition-all font-black uppercase text-xs tracking-widest"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <History className="h-6 w-6" />
                            </div>
                            <span>Histórico de Dossiês</span>
                        </div>
                        <ChevronRight className="h-5 w-5" />
                    </motion.button>
                </div>

                {/* MODAL DE HISTÓRICO DE DOSSIÊS */}
                <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 bg-background border-border overflow-hidden rounded-[2rem]">
                        <div className="p-6 border-b border-border bg-muted/30">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-primary" />
                                    Dossiês da Unidade
                                </DialogTitle>
                                <DialogDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                                    Analítico completo de performance qualitativa
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* LISTA LATERAL (Reports List) */}
                            <div className="w-1/3 border-r border-border overflow-y-auto p-4 space-y-3 bg-muted/10">
                                {unitReports.map((report) => (
                                    <div
                                        key={report.id}
                                        onClick={() => setSelectedHistoryReport(report)}
                                        className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedHistoryReport?.id === report.id
                                            ? 'bg-primary/10 border-primary/30 shadow-lg'
                                            : 'bg-card border-border hover:border-primary/50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(report.report_date).toLocaleDateString('pt-BR')}
                                            </span>
                                            {report.ai_summary.report_depth === 'summary' && (
                                                <Badge variant="outline" className="text-[8px] h-4 px-1 rounded border-slate-700 text-slate-500">RESUMO</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Badge className={`text-[9px] font-black uppercase ${report.ai_summary.priority_level === 'alta' ? 'bg-red-500 hover:bg-red-600' :
                                                report.ai_summary.priority_level === 'média' ? 'bg-amber-500 hover:bg-amber-600' :
                                                    'bg-emerald-500 hover:bg-emerald-600'
                                                } text-white border-none`}>
                                                Risco: {report.ai_summary.priority_level || 'N/A'}
                                            </Badge>
                                            <span className="text-[10px] font-bold">NPS: {report.ai_summary.nps_score?.toFixed(1) || '--'}</span>
                                        </div>
                                    </div>
                                ))}
                                {unitReports.length === 0 && (
                                    <div className="text-center py-10 opacity-50 text-xs uppercase font-bold">Nenhum dossiê encontrado</div>
                                )}
                            </div>

                            {/* LEITOR DE MARKDOWN (Conteúdo) */}
                            <div className="flex-1 overflow-y-auto p-8 bg-card relative">
                                {selectedHistoryReport ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none 
                                        prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter 
                                        prose-p:text-muted-foreground prose-p:font-medium prose-p:leading-relaxed
                                        prose-strong:text-foreground prose-strong:font-black
                                        prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                        prose-ul:list-disc prose-ul:pl-4
                                        prose-li:marker:text-primary">
                                        <div className="mb-6 flex flex-col gap-2 pb-6 border-b border-border">
                                            <Badge className="w-fit bg-primary text-black font-black uppercase tracking-widest mb-2">
                                                Dossiê de Inteligência
                                            </Badge>
                                            <h2 className="text-3xl font-black uppercase italic tracking-tighter m-0 text-foreground">
                                                Análise {new Date(selectedHistoryReport.report_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                            </h2>
                                        </div>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {selectedHistoryReport.ai_summary.markdown_report || '_Dossiê sem conteúdo de texto._'}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 gap-4">
                                        <FileText className="h-16 w-16" />
                                        <span className="text-xs font-black uppercase tracking-[0.3em]">Selecione um dossiê</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Estatísticas da Amostra */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-4 bg-muted/30 border border-border rounded-2xl flex flex-col gap-1 text-card-foreground">
                        <Users className="h-4 w-4 text-muted-foreground mb-1" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase">Total de Feedbacks</span>
                        <span className="text-lg font-black">{metrics?.responses_count || 0}</span>
                    </div>
                    <div className="p-4 bg-muted/30 border border-border rounded-2xl flex flex-col gap-1 text-card-foreground">
                        <Award className="h-4 w-4 text-primary mb-1" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase">Unidade SP15</span>
                        <span className="text-lg font-black text-primary">{metrics?.units?.code}</span>
                    </div>
                </div>
            </main>

            {/* Bottom Nav Mobile */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-background/80 backdrop-blur-xl border-t border-border flex items-center justify-around px-6 z-50">
                <button onClick={() => navigate('/unit-dashboard')} className="flex flex-col items-center gap-1 text-primary">
                    <LayoutDashboard className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Início</span>
                </button>
                <button onClick={() => navigate('/tasks')} className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ClipboardList className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Tarefas</span>
                </button>
                <button onClick={() => setIsRankingOpen(true)} className="flex flex-col items-center gap-1 text-muted-foreground">
                    <History className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Ranking</span>
                </button>
            </nav>

            {/* MODAL DE RANKING */}
            <Dialog open={isRankingOpen} onOpenChange={setIsRankingOpen}>
                <DialogContent className="max-w-3xl bg-card border-border text-foreground rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
                    <div className="h-2 bg-primary w-full" />
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                                    <TrendingUp className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-foreground">Ranking Regional</DialogTitle>
                                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance Comparativa SP15</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="rounded-3xl border border-border overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground w-16 text-center">#</th>
                                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unidade</th>
                                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">NPS</th>
                                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Gap Meta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {rankingList.map((unit) => {
                                        const isCurrentUser = unit.unit_id === metrics?.unit_id;
                                        return (
                                            <tr key={unit.unit_id} className={`group transition-colors ${isCurrentUser ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}`}>
                                                <td className="p-4 text-center">
                                                    <span className={`text-lg font-black italic ${unit.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>#{unit.rank}</span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-bold uppercase ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>{unit.unit_name}</span>
                                                        <span className="text-[9px] font-bold text-muted-foreground">{unit.unit_code}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className={`text-sm font-black tracking-tighter ${unit.nps_score >= 75 ? 'text-emerald-500' : unit.nps_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                                        {unit.nps_score.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        {unit.nps_score < 75 ? `-${(75 - unit.nps_score).toFixed(1)}` : 'Atingido'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <Button variant="ghost" onClick={() => setIsRankingOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                                Fechar Ranking
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
