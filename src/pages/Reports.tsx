import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, Loader2, Calculator, TrendingUp, Building2, Target, MonitorPlay, Maximize2, Trash2, Plus, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { GoogleGenerativeAI } from '@google/generative-ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ActionItem {
    acao: string
    responsavel: string
    prazo: string
}

interface QualitativeReport {
    id: string
    report_date: string
    unit_id: string | null
    ai_summary: {
        type: 'regional' | 'unit'
        // Regional fields
        total_feedbacks?: number
        overall_sentiment?: string
        key_insight?: string
        top_issues?: string[]
        systemic_issues?: string[]
        regional_strengths?: string[]
        // Unit fields (novo formato Markdown)
        unit_name?: string
        feedback_count?: number
        nps_score?: number
        markdown_report?: string
        diagnostico_rapido?: string
        principal_ofensor?: string
        plano_acao?: ActionItem[]
        priority_level?: string
        // Campos antigos para compatibilidade
        executive_summary?: string
        highlights?: string[]
        risks?: string[]
        action_plan?: string[]
    }
    units?: { name: string; code: string }
}

interface NpsMetric {
    id: string
    nps_score: number
    responses_count: number
    promoters_count: number
    detractors_count: number
    position_ranking: number
    goal_2026_1: number
    units: { id: string; name: string; code: string }
}

export default function ReportsPage() {
    const navigate = useNavigate()
    const [reports, setReports] = useState<QualitativeReport[]>([])
    const [metrics, setMetrics] = useState<NpsMetric[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedReport, setSelectedReport] = useState<QualitativeReport | null>(null)
    const [filterPriority, setFilterPriority] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [genProgress, setGenProgress] = useState('')

    useEffect(() => {
        checkAuth()
        fetchReports()
        fetchMetrics()
    }, [])

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) navigate('/login')
    }

    const fetchReports = async () => {
        const { data } = await supabase
            .from('qualitative_reports')
            .select('*, units (name, code)')
            .order('created_at', { ascending: false })

        setReports(data || [])
        setLoading(false)
    }

    const fetchMetrics = async () => {
        // Primeiro busca todas as unidades para garantir que todas apareçam
        const { data: unitsData } = await supabase
            .from('units')
            .select('id, name, code')
            .order('name')

        if (!unitsData) return

        const { data: metricsData } = await supabase
            .from('nps_metrics')
            .select('*, units (id, name, code)')
            .order('created_at', { ascending: false })

        if (metricsData) {
            // Deduplicação: Mantém apenas a entrada mais recente para cada unidade
            const latestMetrics = metricsData.reduce((acc: any, current) => {
                if (!acc[current.unit_id]) {
                    acc[current.unit_id] = current;
                }
                return acc;
            }, {});

            // Mapeia todas as unidades, preenchendo com dados vazios se não houver métrica
            const allUnitsMetrics = unitsData.map(unit => {
                const metric = latestMetrics[unit.id];
                if (metric) return metric;

                // Retorna um objeto "fake" se não houver métrica
                return {
                    id: `dummy-${unit.id}`,
                    nps_score: 0,
                    responses_count: 0,
                    promoters_count: 0,
                    detractors_count: 0,
                    goal_2026_1: 75, // Meta padrão
                    position_ranking: 999,
                    units: unit,
                    unit_id: unit.id
                };
            });

            // Ordena por ranking (menor número = topo)
            const sortedMetrics = allUnitsMetrics.sort((a, b) => (a.position_ranking || 999) - (b.position_ranking || 999));
            setMetrics(sortedMetrics);
        }
    }

    const handleGenerateReports = async () => {
        if (!confirm('Deseja iniciar a geração de novos relatórios com IA? Isso cruzará os dados manuais da Central de Dados com os PDFs processados.')) return

        setIsGenerating(true)
        setGenProgress('Buscando métricas e fontes de dados...')

        try {
            // 1. Buscar métricas mais recentes de cada unidade
            const { data: units } = await supabase.from('units').select('*')
            if (!units) throw new Error('Nenhuma unidade cadastrada.')

            const { data: metricsData } = await supabase
                .from('nps_metrics')
                .select('*')
                .order('created_at', { ascending: false })

            // 2. Buscar PDFs processados
            const { data: sources } = await supabase
                .from('data_sources')
                .select('*')
                .eq('file_type', 'pdf')
                .order('created_at', { ascending: false })

            // 3. Buscar tarefas (Tasks) para análise de Compliance
            const { data: tasksData } = await supabase
                .from('tasks')
                .select('unit_leader_id, status, title, validation_type')

            if (!sources || sources.length === 0) {
                toast.error('Nenhum PDF encontrado na Central de Dados para análise.')
                setIsGenerating(false)
                return
            }

            // Para simplificar, pegaremos o relatório qualitativo "bruto" (texto) que seria extraído dos PDFs
            // Nota: No projeto original, o texto do PDF era processado no momento do upload.
            // Para manter a promessa de "cruzar dados", precisaremos que o texto do PDF esteja acessível.
            // Vou assumir que o sistema extrai o texto no momento do clique se necessário, ou que os dados qualitativos
            // estão vindo dos DataSources. 

            // ATENÇÃO: O usuário quer que ao clicar ele analise TODOS os PDFs e Dados.
            // Vou simular o processo de "conhecimento acumulado".

            setGenProgress('Analisando correlações com Gemini...')

            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY)
            const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

            const pdfTexts = sources.map(s => `Arquivo: ${s.filename}\nTexto: ${s.extracted_text}`).join('\n\n')

            const prompt = `
            VOCÊ É UM CIÊNTISTA DE DADOS E CONSULTOR ESTRATÉGICO DE CX (CUSTOMER EXPERIENCE). 
            Sua missão é gerar um DOSSIÊ EXECUTIVO DE ALTA PRECISÃO. Você deve cruzar métricas numéricas com evidências textuais de forma EXAUSTIVA.

            DADOS DISPONÍVEIS:
            ---
            UNIDADES (ID, NOME, SIGLA):
            ${JSON.stringify(units.map(u => ({ id: u.id, nome: u.name, sigla: u.code })))}

            MÉTRICAS NPS RECENTES E METAS (QUANTITATIVO):
            ${JSON.stringify(metricsData?.map(m => ({
                unit_id: m.unit_id,
                nps: m.nps_score,
                meta: m.goal_2026_1,
                respostas: m.responses_count
            })))}

            FEEDBACKS BRUTOS EXTRAÍDOS DE PDFS (QUALITATIVO):
            ${pdfTexts}

            COMPLIANCE OPERACIONAL (TAREFAS CONCLUÍDAS):
            ${JSON.stringify(tasksData?.map(t => ({
                status: t.status,
                titulo: t.title,
                lider_id: t.unit_leader_id
            })))}
            ---

            TAREFA 1: RELATÓRIO REGIONAL CONSOLIDADO
            - MAPA DE CALOR: Tabela Markdown com as unidades nas linhas e o total de menções a "Manutenção", "Atendimento/Equipe" e "Limpeza" nas colunas.
            - AUDITORIA DE CONTATO: Analise a coluna "Resolução/Feedback 1". Calcule o % de eficácia de contato (contatado vs. sem sucesso).
            - COMPLIANCE VS NPS: Correlacione o % de tarefas concluídas com a média de NPS da rede.
            - INSIGHT ESTRATÉGICO: Qual o maior risco sistêmico para a meta de 75.0?

            TAREFA 2: DOSSIÊ INDIVIDUAL POR UNIDADE (Obrigatório para cada unidade com dados)
            Você deve analisar cada unidade INDIVIDUALMENTE e EXAUSTIVAMENTE. Esperamos relatórios LONGOS e detalhados.
            - DIAGNÓSTICO DE CAUSA RAIZ: Use "5 Porquês" baseados no texto real. Vá fundo no problema técnico.
            - ADERÊNCIA OPERACIONAL: Analise se as tarefas concluídas pela unidade coincidem com as dores relatadas nos feedbacks (Ex: Se há reclamação de limpeza e a tarefa de 'Auditoria de Higiene' foi ignorada, aponte isso).
            - EVIDÊNCIAS: Cite múltiplos fragmentos de comentários relevantes.
            - PLANO DE AÇÃO 5W2H COMPLETO: Crie uma tabela Markdown 5W2H para cada ofensor identificado. Seja ultra-específico nos processos.
            - CORRELAÇÃO: Explique matematicamente como os problemas citados no PDF estão impedindo a unidade de atingir a meta de 75.0.

            REGRAS DE OURO:
            - NÃO use nomes de pessoas.
            - SEJA IMPLACÁVEL. Se o gerente não está conseguindo falar com detratores, aponte como uma falha crítica de liderança.
            - Escreva pelo menos 300-500 palavras de análise técnica por unidade que possua feedbacks.
            - Use tabelas Markdown dentro do campo "markdown_report" para organizar os planos de ação.

            SAÍDA: Retorne APENAS um JSON válido:
            {
                "regional": { 
                    "total_feedbacks": number, 
                    "overall_sentiment": "crítico|alerta|estável", 
                    "key_insight": "...", 
                    "markdown_report": "..." 
                },
                "units": [
                   { 
                     "unit_id": "ID",
                     "nps_at_time": number,
                     "feedback_count": number,
                     "priority_level": "alta|média|baixa", 
                     "markdown_report": "# ANÁLISE EXAUSTIVA - [NOME]\\n..." 
                   }
                ]
            }
            `

            const result = await model.generateContent(prompt)
            const response = await result.response
            const text = response.text()

            // console.log('AI Response:', text)

            // Tentar extrair JSON de forma mais resiliente
            let analysis: any
            try {
                const jsonStr = text.includes('```json')
                    ? text.split('```json')[1].split('```')[0].trim()
                    : text.trim()
                analysis = JSON.parse(jsonStr)
            } catch (pError) {
                console.error('Erro ao processar JSON da IA:', pError)
                throw new Error('A resposta da IA não está no formato esperado. Tente novamente.')
            }

            if (!analysis.regional || !analysis.units) {
                throw new Error('A IA retornou um formato incompleto (faltando regional ou unidades).')
            }

            setGenProgress('Salvando dossiês estratégicos...')

            // Salvar relatório regional
            const { error: regError } = await supabase.from('qualitative_reports').insert({
                report_date: new Date().toISOString().split('T')[0],
                ai_summary: {
                    type: 'regional',
                    total_feedbacks: analysis.regional.total_feedbacks || 0,
                    overall_sentiment: analysis.regional.overall_sentiment || 'neutro',
                    key_insight: analysis.regional.key_insight || '',
                    markdown_report: analysis.regional.markdown_report || ''
                }
            })

            if (regError) {
                console.error('Erro Supabase Regional:', regError)
                throw new Error('Erro ao salvar relatório regional no banco de dados.')
            }

            // Salvar relatórios de unidade
            for (const unitAnalysis of analysis.units) {
                const unit = units.find(u => u.id === unitAnalysis.unit_id)
                if (unit) {
                    const { error: unitError } = await supabase.from('qualitative_reports').insert({
                        unit_id: unit.id,
                        report_date: new Date().toISOString().split('T')[0],
                        ai_summary: {
                            type: 'unit',
                            unit_name: unit.name,
                            nps_score: unitAnalysis.nps_at_time || 0,
                            feedback_count: unitAnalysis.feedback_count || 0,
                            priority_level: unitAnalysis.priority_level || 'média',
                            markdown_report: unitAnalysis.markdown_report || ''
                        }
                    })
                    if (unitError) console.error(`Erro ao salvar unidade ${unit.name}:`, unitError)
                }
            }

            toast.success('Relatórios gerados e salvos com sucesso!')
            fetchReports()
        } catch (error: any) {
            console.error('Erro completo na geração:', error)
            toast.error(error.message || 'Erro inesperado na geração do relatório.')
        } finally {
            setIsGenerating(false)
            setGenProgress('')
        }
    }

    const handleDeleteReport = async (id: string) => {
        if (!confirm('Deseja realmente excluir este dossiê? Esta ação é irreversível.')) return

        const { error } = await supabase
            .from('qualitative_reports')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error('Erro ao excluir relatório: ' + error.message)
        } else {
            toast.success('Dossiê removido do sistema.')
            fetchReports()
        }
    }

    const calculatePromotersNeeded = (metric: NpsMetric) => {
        const { responses_count, promoters_count, detractors_count, goal_2026_1 } = metric
        const neutrals = responses_count - promoters_count - detractors_count
        const promotersNeeded = Math.ceil((goal_2026_1 * responses_count / 100) + detractors_count)
        const additional = Math.max(0, promotersNeeded - promoters_count)

        return { additional, neutrals, canConvert: additional <= neutrals }
    }

    const regionalReports = reports.filter(r => r.ai_summary?.type === 'regional')
    const unitReports = reports.filter(r => {
        if (r.ai_summary?.type !== 'unit') return false;
        if (!filterPriority) return true;
        return r.ai_summary?.priority_level?.toLowerCase() === filterPriority.toLowerCase();
    })

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC]">
            <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b bg-white/80 px-4 backdrop-blur-xl md:px-10 print:hidden shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-xl hover:bg-slate-100 transition-all">
                    <ArrowLeft className="h-5 w-5 text-slate-600" />
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase italic">Intelligence & Reports</h1>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Executive Dossier System</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <Button
                        onClick={handleGenerateReports}
                        disabled={isGenerating}
                        className="gap-2 h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-600/20 transition-all"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> {genProgress}
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" /> Criar Relatório com IA
                            </>
                        )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 h-11 px-6 rounded-xl border-slate-200 text-slate-900 hover:bg-slate-50 font-bold uppercase text-[10px] tracking-widest shadow-sm">
                        <MonitorPlay className="h-4 w-4" /> Gerar PDF / Imprimir
                    </Button>
                </div>
            </header>

            <main className="flex flex-1 flex-col gap-8 p-4 md:p-10 max-w-7xl mx-auto w-full">
                {/* Visão Macro - Relatório Regional */}
                {regionalReports.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Card className="border-none shadow-2xl shadow-primary/5 rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-border">
                            <div className="h-2 bg-primary w-full" />
                            <CardHeader className="bg-white px-8 md:px-12 pt-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-1">
                                        <CardTitle className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
                                            Dossiê Estratégico <span className="text-primary">Regional</span>
                                        </CardTitle>
                                        <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                            Analysis of {regionalReports[0]?.ai_summary.total_feedbacks} high-value feedback points
                                        </CardDescription>
                                    </div>
                                    <Badge className="bg-primary/10 text-primary border-none px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest h-fit">
                                        Status: {regionalReports[0]?.ai_summary.overall_sentiment}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="px-8 md:px-12 pb-12 pt-6">
                                {regionalReports.slice(0, 1).map(report => (
                                    <div key={report.id} className="space-y-8">
                                        {/* Markdown Report (Estilo Dossiê Executivo) */}
                                        {report.ai_summary.markdown_report ? (
                                            <div className="prose prose-slate max-w-none mt-4 p-8 md:p-12 bg-slate-50/50 rounded-[2rem] border border-slate-100 shadow-inner print:shadow-none print:border-none relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                                                    <Building2 className="h-64 w-64" />
                                                </div>
                                                <div className="markdown-content relative z-10">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                    >
                                                        {report.ai_summary.markdown_report}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid md:grid-cols-2 gap-8">
                                                {report.ai_summary.key_insight && (
                                                    <div className="md:col-span-2 p-10 bg-emerald-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-10 opacity-10">
                                                            <TrendingUp className="h-32 w-32" />
                                                        </div>
                                                        <p className="font-black text-emerald-400 flex items-center gap-2 mb-4 uppercase tracking-[0.2em] text-[10px]">
                                                            <Target className="h-4 w-4" />
                                                            Strategic Core Insight
                                                        </p>
                                                        <p className="text-2xl font-bold leading-tight tracking-tight relative z-10">{report.ai_summary.key_insight}</p>
                                                    </div>
                                                )}

                                                {report.ai_summary.regional_strengths && report.ai_summary.regional_strengths.length > 0 && (
                                                    <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                                                        <h4 className="font-black text-slate-900 flex items-center gap-2 mb-6 text-xs uppercase tracking-[0.2em]">
                                                            <div className="h-6 w-1 bg-primary rounded-full" />
                                                            Regional Strengths
                                                        </h4>
                                                        <ul className="space-y-4">
                                                            {report.ai_summary.regional_strengths.map((s: string, i: number) => (
                                                                <li key={i} className="flex gap-4 text-sm font-medium text-slate-600 leading-relaxed">
                                                                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                                    {s}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {((report.ai_summary.top_issues && report.ai_summary.top_issues.length > 0) || (report.ai_summary.systemic_issues && report.ai_summary.systemic_issues.length > 0)) && (
                                                    <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                                                        <h4 className="font-black text-slate-900 flex items-center gap-2 mb-6 text-xs uppercase tracking-[0.2em]">
                                                            <div className="h-6 w-1 bg-amber-500 rounded-full" />
                                                            Critical Vulnerabilities
                                                        </h4>
                                                        <ul className="space-y-4">
                                                            {(report.ai_summary.top_issues || report.ai_summary.systemic_issues)?.map((s: string, i: number) => (
                                                                <li key={i} className="flex gap-4 text-sm font-medium text-slate-600 leading-relaxed">
                                                                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                                                    {s}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                <div className="grid gap-8 md:grid-cols-3">
                    {/* Calculadora de Promotores */}
                    <Card className="border-none shadow-xl rounded-[2rem] bg-slate-900 text-white overflow-hidden">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-widest leading-none">
                                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                    <Calculator className="h-5 w-5" />
                                </div>
                                Target Optimizer
                            </CardTitle>
                            <CardDescription className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Growth calculation for 2026</CardDescription>
                        </CardHeader>
                        <CardContent className="h-full">
                            <div className="space-y-3 pb-8">
                                {metrics.map(metric => {
                                    const calc = calculatePromotersNeeded(metric)
                                    const isOnTarget = metric.nps_score >= metric.goal_2026_1

                                    return (
                                        <div key={metric.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                                            <div className="flex flex-col gap-0.5">
                                                <p className="font-black text-xs uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                                                    {metric.position_ranking < 999 && <span className="text-indigo-500 mr-2">#{metric.position_ranking}</span>}
                                                    {metric.units?.name}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-500">NPS: {Math.round(metric.nps_score * 10) / 10}</span>
                                                    <div className="h-1 w-1 rounded-full bg-slate-700" />
                                                    <span className="text-[10px] font-bold text-slate-500">Meta: {metric.goal_2026_1}</span>
                                                </div>
                                            </div>
                                            {isOnTarget ? (
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                                                    <CheckCircle className="h-3 w-3" /> Target OK
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                                                    <TrendingUp className="h-3 w-3" /> +{calc.additional}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Visão Micro - Relatórios por Unidade */}
                    <div className="md:col-span-2 flex flex-col gap-6">
                        <div className="flex items-end justify-between px-2">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">Unit Investigations</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{unitReports.length} individual reports published</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => navigate('/data-center')}
                                    className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[9px] tracking-widest rounded-xl transition-all shadow-lg"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Data Center
                                </Button>
                                <Select value={filterPriority || 'all'} onValueChange={(v) => setFilterPriority(v === 'all' ? null : v)}>
                                    <SelectTrigger className="h-10 px-4 bg-white border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded-xl transition-all shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            {filterPriority ? `RISK: ${filterPriority}` : 'FILTER PRIORITY'}
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">ALL UNITS</SelectItem>
                                        <SelectItem value="alta">CRITICAL RISK</SelectItem>
                                        <SelectItem value="média">MEDIUM RISK</SelectItem>
                                        <SelectItem value="baixa">LOW RISK</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {unitReports.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-[2rem] border-dashed">
                                <FileText className="h-16 w-16 text-slate-200 mb-6" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Waiting for Data Upload</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {unitReports.map((report, index) => {
                                    const unitName = report.units?.name || report.ai_summary?.unit_name;
                                    const nps = report.ai_summary?.nps_score;
                                    const count = report.ai_summary?.feedback_count;
                                    const priority = report.ai_summary?.priority_level;

                                    return (
                                        <motion.div
                                            key={report.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <Card
                                                className="group relative h-full flex flex-col border border-slate-100 shadow-xl shadow-slate-200/10 hover:shadow-2xl hover:border-emerald-200 transition-all cursor-pointer overflow-hidden rounded-3xl p-6"
                                                onClick={() => setSelectedReport(report)}
                                            >
                                                {/* Indicador Lateral de Prioridade */}
                                                <div className={`absolute top-0 right-0 h-16 w-16 -mr-8 -mt-8 rotate-45 ${priority === 'alta' ? 'bg-red-500' :
                                                    priority === 'média' ? 'bg-yellow-500' : 'bg-slate-200'
                                                    } opacity-20`} />

                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Investigation Unit</span>
                                                        <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors leading-tight">
                                                            {unitName}
                                                        </h4>
                                                    </div>
                                                    {priority === 'alta' && <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />}
                                                </div>

                                                <div className="flex-1 space-y-4">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="bg-slate-50 p-2.5 rounded-2xl flex flex-col">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">NPS</span>
                                                            <span className={`text-lg font-black tracking-tighter ${nps && nps >= 50 ? 'text-primary' : 'text-slate-900'}`}>
                                                                {nps ? nps.toFixed(1) : '--'}
                                                            </span>
                                                        </div>
                                                        <div className="bg-slate-50 p-2.5 rounded-2xl flex flex-col">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Feedbacks</span>
                                                            <span className="text-lg font-black tracking-tighter text-slate-900">
                                                                {count || 0}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2">
                                                        <div className="flex items-center gap-2 text-[9px] font-black uppercase text-indigo-600 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                                            <Maximize2 className="h-3.5 w-3.5" />
                                                            Explore Dossier
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteReport(report.id);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal de Detalalhamento Estruturado */}
                <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                    <DialogContent className="sm:max-w-[800px] lg:max-w-5xl h-[90vh] overflow-hidden border-none shadow-2xl p-0 flex flex-col bg-white rounded-[2.5rem]">
                        {selectedReport && (
                            <>
                                <div className="h-3 bg-gradient-to-r from-emerald-500 to-indigo-600 w-full shrink-0" />
                                <DialogHeader className="p-8 md:p-12 bg-slate-50/50 border-b shrink-0 text-left">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Badge className="bg-white text-slate-900 border-slate-200 shadow-sm text-[10px] px-4 py-1.5 font-black uppercase tracking-widest">
                                            {selectedReport.units?.name || selectedReport.ai_summary?.unit_name}
                                        </Badge>
                                        <Badge className={`text-[10px] px-4 py-1.5 font-black uppercase tracking-widest border-none shadow-lg ${selectedReport.ai_summary.priority_level === 'alta' ? 'bg-red-500 text-white shadow-red-500/20' :
                                            selectedReport.ai_summary.priority_level === 'média' ? 'bg-amber-500 text-white shadow-amber-500/20' :
                                                'bg-slate-900 text-white shadow-slate-900/20'
                                            }`}>
                                            Risk: {selectedReport.ai_summary.priority_level || 'Normal'}
                                        </Badge>
                                    </div>
                                    <DialogTitle className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                                        Executive Unit Report
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
                                        Qualitative Sentiment Analysis • {selectedReport.ai_summary.feedback_count} Points
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="p-8 md:p-14 pb-20">
                                        {/* Conteúdo Markdown Direto com Custom Styling */}
                                        {selectedReport.ai_summary?.markdown_report ? (
                                            <div className="prose prose-slate max-w-none">
                                                <div className="markdown-content">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                    >
                                                        {selectedReport.ai_summary.markdown_report}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
                                                <AlertTriangle className="h-12 w-12 opacity-20" />
                                                <p className="text-xs font-black uppercase tracking-[0.3em]">No Processed Data Available</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}
