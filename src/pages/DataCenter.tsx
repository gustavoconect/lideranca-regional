import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, FileText, Database, ShieldCheck, Trash2, Calendar, FileSpreadsheet } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { ManualMetricForm } from '@/components/forms/manual-metric-form'
import { PdfUploadForm } from '@/components/forms/pdf-upload-form'
import { Settings, Building2 } from 'lucide-react'

interface DataSource {
    id: string
    filename: string
    file_type: 'csv' | 'pdf'
    extraction_date: string
    created_at: string
}

interface NpsMetric {
    id: string
    unit_id: string
    nps_score: number
    nps_semestral: number
    goal_2026_1: number
    week_start_date: string
    week_label: string
    responses_count: number
    created_at: string
    units: {
        name: string
        code: string
    }
}

export default function DataCenter() {
    const navigate = useNavigate()
    const [metrics, setMetrics] = useState<NpsMetric[]>([])
    const [sources, setSources] = useState<DataSource[]>([])

    const fetchSources = async () => {
        const { data, error } = await supabase
            .from('data_sources')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) {
            setSources(data)
        }
    }

    const fetchManualMetrics = async () => {
        const { data, error } = await supabase
            .from('nps_metrics')
            .select('*, units (name, code)')
            .order('week_start_date', { ascending: false })

        if (!error && data) {
            setMetrics(data)
        }
    }

    useEffect(() => {
        fetchSources()
        fetchManualMetrics()
    }, [])

    const deleteManualMetric = async (id: string) => {
        if (!confirm('Deseja realmente excluir este registro semanal?')) return

        try {
            const { error } = await supabase
                .from('nps_metrics')
                .delete()
                .eq('id', id)

            if (error) throw error

            setMetrics(prev => prev.filter(m => m.id !== id))
            toast.success('Registro removido.')
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message)
        }
    }

    const deleteSource = async (id: string, filename: string) => {
        const confirmDelete = window.confirm(`Tem certeza que deseja excluir "${filename}"? Todos os dados vinculados a este arquivo serão removidos permanentemente.`)
        if (!confirmDelete) return

        try {
            const { error } = await supabase
                .from('data_sources')
                .delete()
                .eq('id', id)

            if (error) throw error

            setSources(prev => prev.filter(s => s.id !== id))
            toast.success(`Fonte "${filename}" removida.`)
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR')
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-6 md:px-12 bg-background/80 border-b border-border backdrop-blur-2xl">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/reports')} className="rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tighter text-foreground uppercase italic">Central de Dados Estratégicos</h1>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Gerenciamento de Fontes de Conhecimento</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/units')}
                        className="gap-2 h-11 px-6 rounded-xl border-slate-800 bg-slate-900/50 text-slate-300 hover:text-white hover:bg-slate-800 font-bold uppercase text-[10px] tracking-widest transition-all"
                    >
                        <Settings className="h-4 w-4" /> Gestão de Unidades
                    </Button>
                    <Badge className="bg-primary/10 text-primary border-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                        DB SECURE: AES-256
                    </Badge>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-12">
                <Tabs defaultValue="metrics" className="space-y-8">
                    <div className="flex items-center justify-between">
                        <TabsList className="bg-muted border-border p-1 rounded-2xl h-14">
                            <TabsTrigger value="metrics" className="rounded-xl px-8 h-12 data-[state=active]:bg-primary data-[state=active]:text-black font-black uppercase text-[10px] tracking-widest gap-2">
                                <FileSpreadsheet className="h-4 w-4" />
                                Métricas (CSV)
                            </TabsTrigger>
                            <TabsTrigger value="pdf" className="rounded-xl px-8 h-12 data-[state=active]:bg-primary data-[state=active]:text-black font-black uppercase text-[10px] tracking-widest gap-2">
                                <FileText className="h-4 w-4" />
                                Conhecimento (PDF)
                            </TabsTrigger>
                        </TabsList>

                        <div className="hidden md:flex items-center gap-2 px-6 py-3 bg-muted border border-border rounded-2xl">
                            <Database className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Total de Fontes: {sources.length}
                            </span>
                        </div>
                    </div>

                    <TabsContent value="metrics" className="grid gap-8 lg:grid-cols-12 outline-none">
                        <div className="lg:col-span-12">
                            <ManualMetricForm onSave={fetchManualMetrics} />
                        </div>

                        <div className="lg:col-span-12 space-y-4">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Histórico de Performance</h2>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">Registros semanais alimentados manualmente</p>
                            </div>

                            <Card className="bg-slate-900 border-none ring-1 ring-slate-800 rounded-[2.5rem] overflow-hidden">
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        {metrics.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full py-20 opacity-20 italic">
                                                <Database className="h-12 w-12 mb-4" />
                                                <p className="text-xs uppercase font-black tracking-widest">Nenhum dado registrado ainda</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-800">
                                                <AnimatePresence>
                                                    {metrics.map((metric) => (
                                                        <motion.div
                                                            key={metric.id}
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: 20 }}
                                                            className="flex items-center justify-between p-6 bg-slate-900/50 hover:bg-slate-800 transition-all group border-b border-slate-800/50 last:border-none"
                                                        >
                                                            <div className="flex items-center gap-6">
                                                                <div className="p-4 rounded-2xl bg-slate-950 text-indigo-500 shadow-inner group-hover:text-indigo-400 transition-colors">
                                                                    <Building2 className="h-6 w-6" />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <p className="text-sm font-black text-white uppercase tracking-tight">{metric.units?.name}</p>
                                                                        <Badge className="bg-slate-800 text-slate-400 border-none text-[8px] font-black px-2">
                                                                            {metric.units?.code}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                            <Calendar className="h-3 w-3" />
                                                                            {metric.week_label || formatDate(metric.week_start_date)}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-700">•</span>
                                                                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                                                                            NPS Semana: {metric.nps_score?.toFixed(1)}
                                                                        </span>
                                                                        {metric.nps_semestral && (
                                                                            <>
                                                                                <span className="text-[10px] text-slate-700">•</span>
                                                                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                                                                    NPS Semestral: {metric.nps_semestral.toFixed(1)}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => deleteManualMetric(metric.id)}
                                                                    className="h-12 w-12 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl"
                                                                >
                                                                    <Trash2 className="h-5 w-5" />
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="pdf" className="grid gap-8 lg:grid-cols-12 outline-none">
                        <div className="lg:col-span-12">
                            <PdfUploadForm onImportComplete={fetchSources} />
                        </div>

                        <div className="lg:col-span-12 space-y-4">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Histórico de Conhecimento</h2>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">Gerencie os arquivos PDF processados pela IA</p>
                            </div>

                            <Card className="bg-slate-900 border-none ring-1 ring-slate-800 rounded-[2.5rem] overflow-hidden">
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        {sources.filter(s => s.file_type === 'pdf').length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full py-20 opacity-20 italic">
                                                <FileText className="h-12 w-12 mb-4" />
                                                <p className="text-xs uppercase font-black tracking-widest">Nenhum arquivo PDF cadastrado</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-800">
                                                <AnimatePresence>
                                                    {sources.filter(s => s.file_type === 'pdf').map((source) => (
                                                        <motion.div
                                                            key={source.id}
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: 20 }}
                                                            className="flex items-center justify-between p-6 bg-slate-900/50 hover:bg-slate-800 transition-all group border-b border-slate-800/50 last:border-none"
                                                        >
                                                            <div className="flex items-center gap-6">
                                                                <div className="p-4 rounded-2xl bg-slate-950 text-indigo-500 shadow-inner group-hover:text-indigo-400 transition-colors">
                                                                    <FileText className="h-6 w-6" />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <p className="text-sm font-black text-white uppercase tracking-tight">{source.filename}</p>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                            <Calendar className="h-3 w-3" />
                                                                            Processado em: {formatDate(source.extraction_date)}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-700">•</span>
                                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                                                            Upload: {formatDate(source.created_at)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => deleteSource(source.id, source.filename)}
                                                                    className="h-12 w-12 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl"
                                                                >
                                                                    <Trash2 className="h-5 w-5" />
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="mt-12 p-8 bg-muted/30 rounded-[2.5rem] border border-border flex items-start gap-4">
                    <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-1" />
                    <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1 italic">Governança de Dados</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed tracking-widest italic">
                            A Central de Dados permite o controle total sobre o que alimenta o motor estratégico. A exclusão de uma fonte remove em cascata todos os cálculos de NPS e relatórios associados, garantindo a integridade dos dashboards.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
