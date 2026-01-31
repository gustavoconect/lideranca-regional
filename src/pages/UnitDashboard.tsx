
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
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-black/60">Posição Ranking</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-black italic">#{metrics?.position_ranking || '--'}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border shadow-xl rounded-3xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">NPS Atual</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-4xl font-black italic ${metrics?.nps_score && metrics.nps_score >= metrics.goal_2026_1 ? 'text-primary' : 'text-primary/70'}`}>
                                {metrics?.nps_score?.toFixed(1) || '--'}
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
                                : "Aumente o contato com detratores para atingir o objetivo estratégico."}
                        </p>
                    </div>
                </Card>

                {/* Ações Rápidas */}
                <div className="grid gap-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-2">Ações Operacionais</h3>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/tasks')}
                        className="flex items-center justify-between p-6 bg-primary rounded-3xl text-black shadow-lg shadow-primary/10 transition-all font-black uppercase text-xs tracking-widest"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-black/10 rounded-xl">
                                <ClipboardList className="h-6 w-6" />
                            </div>
                            <span>Minhas Tarefas</span>
                        </div>
                        <ChevronRight className="h-5 w-5" />
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/reports')}
                        className="flex items-center justify-between p-6 bg-card border border-border rounded-3xl text-foreground shadow-lg transition-all font-black uppercase text-xs tracking-widest"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                            <span>Relatório Unidade</span>
                        </div>
                        <ChevronRight className="h-5 w-5" />
                    </motion.button>
                </div>

                {/* Estatísticas da Amostra */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-4 bg-muted/30 border border-border rounded-2xl flex flex-col gap-1 text-card-foreground">
                        <Users className="h-4 w-4 text-muted-foreground mb-1" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase">Total de Feedbacks</span>
                        <span className="text-lg font-black">{metrics?.responses_count || 0}</span>
                    </div>
                    <div className="p-4 bg-muted/30 border border-border rounded-2xl flex flex-col gap-1 text-card-foreground">
                        <Award className="h-4 w-4 text-primary mb-1" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase">Status Unidade</span>
                        <span className="text-lg font-black text-primary">ELITE</span>
                    </div>
                </div>
            </main>

            {/* Bottom Nav Mobile */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-background/80 backdrop-blur-xl border-t border-border flex items-center justify-around px-6 z-50">
                <button onClick={() => navigate('/unit-dashboard')} className="flex flex-col items-center gap-1 text-primary">
                    <LayoutDashboard className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Home</span>
                </button>
                <button onClick={() => navigate('/tasks')} className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ClipboardList className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Tarefas</span>
                </button>
                <button onClick={() => navigate('/reports')} className="flex flex-col items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-6 w-6" />
                    <span className="text-[8px] font-black uppercase">Ranking</span>
                </button>
            </nav>
        </div>
    )
}
