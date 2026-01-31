import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, FileText, Database, ShieldCheck, Trash2, Calendar, FileSpreadsheet, Building2, LayoutGrid, ListFilter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { ManualMetricForm } from '@/components/forms/manual-metric-form'
import { PdfUploadForm } from '@/components/forms/pdf-upload-form'

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
    const [activeTab, setActiveTab] = useState('metrics')

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
        <div className="flex min-h-screen w-full flex-col bg-black text-white font-sans selection:bg-primary selection:text-black">
            {/* Header Elite */}
            <header className="sticky top-0 z-50 flex h-20 items-center justify-between px-6 md:px-12 bg-black/60 border-b border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/reports')}
                        className="rounded-full hover:bg-white/10 text-white/50 hover:text-primary transition-all scale-110"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tight uppercase italic skew-x-[-10deg]">
                                Central de <span className="text-primary">Dados</span>
                            </h1>
                            <Badge className="bg-primary text-black border-none px-2 py-0 text-[10px] font-black uppercase tracking-tighter rounded-sm">
                                V2.1 ELITE
                            </Badge>
                        </div>
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.4em] mt-1 pulse-slow">Protocolo de Alimentação Estratégica</p>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Sincronização Ativa</span>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[11px] font-bold text-white/60 uppercase">Supabase Cloud</span>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <Button
                        onClick={() => navigate('/units')}
                        className="h-11 px-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[11px] font-black uppercase tracking-wider transition-all gap-2"
                    >
                        <Building2 className="h-4 w-4 text-primary" /> Gestão de Unidades
                    </Button>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 md:p-10 grid lg:grid-cols-[1fr,380px] gap-10">

                {/* Coluna Esquerda: Ação Principal */}
                <div className="space-y-10">
                    <Tabs defaultValue="metrics" className="w-full" onValueChange={setActiveTab}>
                        <div className="flex items-center justify-between mb-8">
                            <TabsList className="bg-white/5 p-1.5 rounded-xl h-14 border border-white/5 shadow-2xl">
                                <TabsTrigger
                                    value="metrics"
                                    className="rounded-lg px-8 h-11 data-[state=active]:bg-primary data-[state=active]:text-black font-black uppercase text-[11px] tracking-widest gap-2 transition-all duration-300"
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Métricas Semanais
                                </TabsTrigger>
                                <TabsTrigger
                                    value="pdf"
                                    className="rounded-lg px-8 h-11 data-[state=active]:bg-primary data-[state=active]:text-black font-black uppercase text-[11px] tracking-widest gap-2 transition-all duration-300"
                                >
                                    <FileText className="h-4 w-4" />
                                    Knowledge (PDF)
                                </TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-xl border border-white/5">
                                <Database className="h-4 w-4 text-primary" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Registros Totais</span>
                                    <span className="text-[12px] font-black text-primary leading-none">{activeTab === 'metrics' ? metrics.length : sources.filter(s => s.file_type === 'pdf').length}</span>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            <TabsContent value="metrics" className="outline-none m-0">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <ManualMetricForm onSave={fetchManualMetrics} />
                                </motion.div>
                            </TabsContent>

                            <TabsContent value="pdf" className="outline-none m-0">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <PdfUploadForm onImportComplete={fetchSources} />
                                </motion.div>
                            </TabsContent>
                        </AnimatePresence>
                    </Tabs>

                    {/* Banner de Segurança Elite */}
                    <div className="relative overflow-hidden group p-8 rounded-[2rem] bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 flex items-center gap-6">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(240,185,11,0.1),transparent)]" />
                        <div className="p-4 rounded-2xl bg-primary/20 text-primary">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest italic mb-1">Criptografia de Dados Nível Bancário</h3>
                            <p className="text-[11px] font-bold text-white/50 leading-relaxed uppercase tracking-wider max-w-2xl">
                                Todos os indicadores e feedbacks processados são protegidos com AES-256 bits. A exclusão de uma fonte é permanente e remove todos os metadados associados nos dashboards.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Coluna Direita: Feed de Histórico Comprimido */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                                <ListFilter className="h-5 w-5" />
                            </div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Feed Recente</h2>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase border-white/10 text-white/40 tracking-widest">Live</Badge>
                    </div>

                    <Card className="bg-white/5 border-white/10 rounded-[2rem] flex-1 overflow-hidden backdrop-blur-sm">
                        <CardContent className="p-0 flex flex-col h-full">
                            <ScrollArea className="flex-1 max-h-[calc(100vh-320px)]">
                                <div className="p-6 space-y-4">
                                    <AnimatePresence mode="popLayout">
                                        {activeTab === 'metrics' ? (
                                            metrics.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                                                    <Database className="h-10 w-10 mb-3" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Sem registros</span>
                                                </div>
                                            ) : (
                                                metrics.map((metric) => (
                                                    <motion.div
                                                        key={metric.id}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        className="group p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-primary/30 transition-all cursor-default"
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-[12px] font-black text-white uppercase tracking-tight truncate max-w-[180px]">
                                                                    {metric.units?.name}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{metric.units?.code}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[14px] font-black text-primary italic">{metric.nps_score.toFixed(1)}</span>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => deleteManualMetric(metric.id)}
                                                                    className="h-8 w-8 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-4 text-[9px] font-black uppercase text-white/40 tracking-widest border-t border-white/5 pt-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-3 w-3 text-primary" />
                                                                {formatDate(metric.week_start_date)}
                                                            </div>
                                                            <Badge className="bg-white/5 text-white/60 border-none text-[8px] font-bold h-5 px-2">MANUAL</Badge>
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )
                                        ) : (
                                            sources.filter(s => s.file_type === 'pdf').length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                                                    <FileText className="h-10 w-10 mb-3" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Sem arquivos</span>
                                                </div>
                                            ) : (
                                                sources.filter(s => s.file_type === 'pdf').map((source) => (
                                                    <motion.div
                                                        key={source.id}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        className="group p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-primary/30 transition-all cursor-default"
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-black text-white uppercase tracking-tight truncate max-w-[180px]">
                                                                    {source.filename}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Processado via IA</span>
                                                            </div>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => deleteSource(source.id, source.filename)}
                                                                className="h-8 w-8 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-4 text-[9px] font-black uppercase text-white/40 tracking-widest border-t border-white/5 pt-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-3 w-3 text-primary" />
                                                                {formatDate(source.extraction_date)}
                                                            </div>
                                                            <Badge className="bg-primary/10 text-primary/80 border-none text-[8px] font-bold h-5 px-2">PDF</Badge>
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )
                                        )}
                                    </AnimatePresence>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Dica do Dia / Insight */}
                    <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                            <LayoutGrid className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Dica Elite</span>
                        </div>
                        <p className="text-[10px] font-bold text-white/40 uppercase leading-relaxed tracking-wider">
                            Para melhores análises qualitativas, tente fazer o upload de PDFs que contenham pelo menos 10 feedbacks detalhados por unidade.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
