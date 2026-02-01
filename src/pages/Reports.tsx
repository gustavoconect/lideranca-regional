import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, Loader2, Calculator, TrendingUp, Building2, Target, MonitorPlay, Trash2, Sparkles, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { extractSurveys } from '@/utils/pdf-processing'
import { GoogleGenerativeAI } from '@google/generative-ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ActionItem {
    acao: string
    responsavel: string
    prazo: string
}

interface Unit {
    id: string
    name: string
    code: string
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
        report_depth?: 'summary' | 'deep'
        unit_code?: string
        nps_variation?: number
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
    const [units, setUnits] = useState<Unit[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedReport, setSelectedReport] = useState<QualitativeReport | null>(null)
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
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

        if (unitsData) setUnits(unitsData)

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

            // 2. Buscar PDFs processados (apenas os que tem texto extraído e não foram deletados)
            const { data: sources, error: idsError } = await supabase
                .from('data_sources')
                .select('*')
                .eq('file_type', 'pdf')
                .not('extracted_text', 'is', null) // Garante que tem texto
                .order('created_at', { ascending: false })
                // Opcional: Limitar aos últimos 30 dias ou X arquivos para não estourar contexto
                .limit(20)

            if (idsError) throw idsError

            // 3. Buscar tarefas (Tasks) para análise de Compliance
            const { data: tasksData } = await supabase
                .from('tasks')
                .select('unit_leader_id, status, title, validation_type')

            if (!sources || sources.length === 0) {
                toast.error('Nenhum dado de PDF válido encontrado na Central de Dados.')
                setIsGenerating(false)
                return
            }

            setGenProgress('Decodificando Knowledge Base...')

            // Processar e estruturar os textos dos PDFs
            const groupedSurveys: Record<string, {
                UnitCode: string
                UnitName: string
                Surveys: { Comment: string, Score: number | null, LeaderFeedback: string }[]
            }> = {}

            sources.forEach(source => {
                if (!source.extracted_text) return

                const surveys = extractSurveys(source.extracted_text)

                surveys.forEach(survey => {
                    // Normaliza Unit Code para evitar duplicatas (SBRSP01 == sbrsp01)
                    const unitKey = survey.unitCode.toUpperCase()

                    if (!groupedSurveys[unitKey]) {
                        const unitName = units.find(u => u.code.toUpperCase() === unitKey)?.name || survey.unitCode
                        groupedSurveys[unitKey] = {
                            UnitCode: unitKey,
                            UnitName: unitName,
                            Surveys: []
                        }
                    }

                    // Evita comentários duplicados exatos (mesmo texto, mesma nota)
                    const isDuplicate = groupedSurveys[unitKey].Surveys.some(s =>
                        s.Comment === (survey.comment || "[Sem Comentário]") && s.Score === survey.npsScore
                    )

                    if (!isDuplicate) {
                        groupedSurveys[unitKey].Surveys.push({
                            Comment: survey.comment || "[Sem Comentário]",
                            Score: survey.npsScore,
                            LeaderFeedback: survey.leaderFeedback
                        })
                    }
                })
            })

            // Formatar para o Prompt como JSON Estruturado
            // Filtra unidades que não têm surveys para não poluir o prompt com dados vazios
            // ADAPTIVE LOGIC: Unidades com < 5 feedbacks recebem relatório "summary" (resumido). >= 5 recebem "deep".
            const validUnitsPayload = Object.values(groupedSurveys)
                .filter(u => u.Surveys.length > 0)
                .map(u => ({
                    ...u,
                    ReportType: u.Surveys.length < 5 ? 'summary' : 'deep'
                }))

            const pdfTexts = validUnitsPayload.length > 0
                ? JSON.stringify(validUnitsPayload, null, 2)
                : 'Nenhum dado extraído dos PDFs.'

            setGenProgress('Carregando diretrizes de IA...')

            const { data: promptData } = await supabase
                .from('ai_prompts')
                .select('prompt_text')
                .eq('slug', 'report_generation')
                .single()

            const basePrompt = promptData?.prompt_text || `
            VOCÊ É UM CIÊNTISTA DE DADOS E CONSULTOR ESTRATÉGICO DE CX (CUSTOMER EXPERIENCE).
            Sua missão é gerar relatórios adaptados ao volume de dados de cada unidade.

            DADOS DISPONÍVEIS:
            ---
            UNIDADES (ID, NOME, SIGLA):
            {{units}}

            MÉTRICAS NPS RECENTES E METAS (QUANTITATIVO):
            {{metrics}}

            FEEDBACKS BRUTOS ESTRUTURADOS (JSON):
            {{pdfTexts}}

            COMPLIANCE OPERACIONAL (TAREFAS CONCLUÍDAS):
            {{tasks}}
            ---

            TAREFA 1: RELATÓRIO REGIONAL CONSOLIDADO (MACRO)
            - MAPA DE CALOR: Tabela Markdown com as unidades nas linhas e o total de menções a "Manutenção", "Atendimento/Equipe" e "Limpeza" nas colunas.
            - AUDITORIA DE CONTATO: Analise a coluna "Resolução/Feedback 1". Calcule o % de eficácia de contato (contatado vs. sem sucesso).
            - COMPLIANCE VS NPS: Correlacione o % de tarefas concluídas com a média de NPS da rede.
            - INSIGHT ESTRATÉGICO: Qual o maior risco sistêmico para a meta de 75.0?

            TAREFA 2: DOSSIÊ INDIVIDUAL POR UNIDADE (ADAPTATIVO)
            ATENÇÃO: Cada unidade no JSON de "FEEDBACKS" possui um campo "ReportType" ("deep" ou "summary").
            
            >>> SE ReportType == "deep" (Muitos dados):
            Gere uma análise EXAUSTIVA e LONGA.
            - DIAGNÓSTICO DE CAUSA RAIZ (5 PORQUÊS): Baseado nos textos.
            - ADERÊNCIA OPERACIONAL: Cruzar com tarefas.
            - EVIDÊNCIAS: Citar múltiplos fragmentos.
            - PLANO DE AÇÃO 5W2H: Tabela completa.
            - CORRELAÇÃO MATEMÁTICA: Impacto na meta.
            - Tamanho esperado: 400-600 palavras.

            >>> SE ReportType == "summary" (Poucos dados):
            Gere uma análise DIRETA e RESUMIDA (Quick Wins).
            - DIAGNÓSTICO RÁPIDO: 1 parágrafo identificando o principal ofensor.
            - EVIDÊNCIA CHAVE: Cite apenas 1 feedback representativo.
            - AÇÃO IMEDIATA: 1 bullet point com a ação mais óbvia a ser tomada.
            - Tamanho esperado: 100-150 palavras.
            - NÃO GERE TABELAS 5W2H PARA ESTES CASOS, use apenas texto corrido e bullets.

            REGRAS GERAIS:
            - NÃO use nomes de pessoas.
            - SEJA IMPLACÁVEL com falhas de liderança.
            - Use tabelas Markdown dentro do campo "markdown_report".

            SAÍDA ESPERADA (JSON):
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
                     "report_depth": "deep|summary",
                     "markdown_report": "# RELATÓRIO [NOME]\\n..." 
                   }
                ]
            }
            `

            const finalPrompt = basePrompt
                .replace('{{units}}', JSON.stringify(units.map(u => ({ id: u.id, nome: u.name, sigla: u.code }))))
                .replace('{{metrics}}', JSON.stringify(metricsData?.map(m => ({
                    unit_id: m.unit_id,
                    nps: m.nps_score,
                    meta: m.goal_2026_1,
                    respostas: m.responses_count
                }))))
                .replace('{{pdfTexts}}', pdfTexts)
                .replace('{{tasks}}', JSON.stringify(tasksData?.map(t => ({
                    status: t.status,
                    titulo: t.title,
                    lider_id: t.unit_leader_id
                }))))

            // Instanciar o modelo (garantindo que a chave existe)
            const apiKey = import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY
            if (!apiKey) throw new Error('Chave de API do Google não configurada.')

            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

            const result = await model.generateContent(finalPrompt)
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
                    markdown_report: analysis.regional.markdown_report || '',
                    report_depth: 'deep'
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
                            markdown_report: unitAnalysis.markdown_report || '',
                            report_depth: unitAnalysis.report_depth || 'deep'
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

    // Group units that have reports
    const unitsWithReports = useMemo(() => {
        const uniqueUnitIds = [...new Set(reports.filter(r => r.unit_id).map(r => r.unit_id))]
        return units
            .filter(u => uniqueUnitIds.includes(u.id))
            .map(u => {
                const unitReports = reports.filter(r => r.unit_id === u.id)
                const latestReport = unitReports.sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())[0]
                return {
                    ...u,
                    reportCount: unitReports.length,
                    latestReport
                }
            })
    }, [reports, units])

    const filteredUnits = useMemo(() => {
        if (!filterPriority) return unitsWithReports;
        return unitsWithReports.filter(u => u.latestReport?.ai_summary?.priority_level?.toLowerCase() === filterPriority.toLowerCase());
    }, [unitsWithReports, filterPriority]);

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
                    <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase italic">Inteligência & Relatórios</h1>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Sistema de Dossiês Executivos</p>
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
                                            Análise de {regionalReports[0]?.ai_summary.total_feedbacks} feedbacks de alto valor
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
                                                            Insight Estratégico Central
                                                        </p>
                                                        <p className="text-2xl font-bold leading-tight tracking-tight relative z-10">{report.ai_summary.key_insight}</p>
                                                    </div>
                                                )}

                                                {report.ai_summary.regional_strengths && report.ai_summary.regional_strengths.length > 0 && (
                                                    <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                                                        <h4 className="font-black text-slate-900 flex items-center gap-2 mb-6 text-xs uppercase tracking-[0.2em]">
                                                            <div className="h-6 w-1 bg-primary rounded-full" />
                                                            Pontos Fortes Regionais
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
                                                            Vulnerabilidades Críticas
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
                                Otimizador de Metas
                            </CardTitle>
                            <CardDescription className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Cálculo de crescimento para 2026</CardDescription>
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
                                <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">Mapa de Investigação</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredUnits.length} unidades com dossiês ativos</p>
                            </div>
                            <div className="flex gap-2">
                                <Select value={filterPriority || 'all'} onValueChange={(v) => setFilterPriority(v === 'all' ? null : v)}>
                                    <SelectTrigger className="h-10 px-4 bg-white border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded-xl transition-all shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            {filterPriority ? `STAT: ${filterPriority}` : 'PRIORIDADE'}
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">TODAS</SelectItem>
                                        <SelectItem value="alta">CRÍTICO</SelectItem>
                                        <SelectItem value="média">ALERTA</SelectItem>
                                        <SelectItem value="baixa">ESTÁVEL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {filteredUnits.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-[2.5rem] border-dashed shadow-inner">
                                <FileText className="h-16 w-16 text-slate-100 mb-6" />
                                <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">Aguardando Inteligência Tática</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredUnits.map((unit, index) => {
                                    const priority = unit.latestReport?.ai_summary?.priority_level;
                                    const nps = unit.latestReport?.ai_summary?.nps_score;

                                    return (
                                        <motion.div
                                            key={unit.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <Card
                                                className="group relative h-full flex flex-col border border-border/50 shadow-xl hover:shadow-2xl hover:border-primary/30 transition-all cursor-pointer overflow-hidden rounded-[2rem] p-8"
                                                onClick={() => setSelectedUnitId(unit.id)}
                                            >
                                                <div className="flex justify-between items-start mb-8">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`h-2 w-2 rounded-full ${priority === 'alta' ? 'bg-red-500 animate-pulse' : priority === 'média' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade: {unit.code}</span>
                                                        </div>
                                                        <h4 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors leading-tight italic uppercase">
                                                            {unit.name}
                                                        </h4>
                                                    </div>
                                                </div>

                                                <div className="flex-1 space-y-6">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status NPS</span>
                                                            <span className={`text-3xl font-black tracking-tighter ${nps && nps >= 70 ? 'text-emerald-500' : nps && nps >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                                                {nps ? nps.toFixed(1) : '--'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dossiês</span>
                                                            <span className="text-2xl font-black tracking-tighter text-slate-900">
                                                                {unit.reportCount}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-[9px] font-black uppercase text-primary group-hover:translate-x-1 transition-transform">
                                                            Ver Histórico <ChevronRight className="h-3 w-3" />
                                                        </div>
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
                                            Risco: {selectedReport.ai_summary.priority_level || 'Normal'}
                                        </Badge>
                                    </div>
                                    <DialogTitle className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                                        Análise Executiva CX
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
                                        Ponto de Controle: {new Date(selectedReport.report_date).toLocaleDateString('pt-BR')} • {selectedReport.ai_summary.feedback_count} Feedbacks Adicionados
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
                                        ) : selectedReport.ai_summary?.executive_summary ? (
                                            // LEGACY REPORT RENDERER
                                            <div className="space-y-8">
                                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Resumo Executivo (Legado)</h4>
                                                    <p className="text-slate-700 leading-relaxed font-medium">
                                                        {selectedReport.ai_summary.executive_summary}
                                                    </p>
                                                </div>

                                                {selectedReport.ai_summary.highlights && (
                                                    <div className="space-y-4">
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600">Destaques Positivos</h4>
                                                        <ul className="grid gap-3">
                                                            {selectedReport.ai_summary.highlights.map((item, i) => (
                                                                <li key={i} className="flex gap-3 text-sm text-slate-600">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {selectedReport.ai_summary.risks && (
                                                    <div className="space-y-4">
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-amber-600">Pontos de Atenção</h4>
                                                        <ul className="grid gap-3">
                                                            {selectedReport.ai_summary.risks.map((item, i) => (
                                                                <li key={i} className="flex gap-3 text-sm text-slate-600">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {selectedReport.ai_summary.action_plan && (
                                                    <div className="space-y-4">
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600">Plano de Ação Sugerido</h4>
                                                        <ul className="grid gap-3">
                                                            {selectedReport.ai_summary.action_plan.map((item, i) => (
                                                                <li key={i} className="flex gap-3 text-sm text-slate-600">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
                                                <AlertTriangle className="h-12 w-12 opacity-20" />
                                                <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhum dado processado disponível</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                            </>
                        )}
                    </DialogContent>
                </Dialog>
                {/* Modal de Histórico da Unidade */}
                <Dialog open={!!selectedUnitId} onOpenChange={(open) => !open && setSelectedUnitId(null)}>
                    <DialogContent className="sm:max-w-[600px] border-none shadow-2xl p-0 flex flex-col bg-white rounded-[2rem]">
                        {selectedUnitId && (
                            <>
                                <DialogHeader className="p-10 bg-slate-50/50 border-b shrink-0 text-left">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Badge className="bg-slate-900 text-white border-none text-[8px] px-3 py-1 font-black uppercase tracking-widest">
                                            Histórico de Dossiês
                                        </Badge>
                                    </div>
                                    <DialogTitle className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                                        {units.find(u => u.id === selectedUnitId)?.name}
                                    </DialogTitle>
                                </DialogHeader>

                                <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {reports
                                        .filter(r => r.unit_id === selectedUnitId)
                                        .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
                                        .map((report) => (
                                            <div
                                                key={report.id}
                                                className="group flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer"
                                                onClick={() => {
                                                    setSelectedReport(report)
                                                    setSelectedUnitId(null)
                                                }}
                                            >
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-slate-900">
                                                            {new Date(report.report_date).toLocaleDateString('pt-BR')}
                                                        </span>
                                                        <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-widest px-2 py-0 border-none ${report.ai_summary?.report_depth === 'deep'
                                                            ? 'bg-indigo-100 text-indigo-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                            {report.ai_summary?.report_depth === 'deep' ? 'Análise Profunda' : 'Resumo Executivo'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                        NPS: {report.ai_summary.nps_score?.toFixed(1) || '--'} • {report.ai_summary.feedback_count || 0} Feedbacks
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteReport(report.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                                <div className="p-6 bg-slate-50/50 rounded-b-[2rem] border-t">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase text-center tracking-widest italic">
                                        Clique em um dossiê para abrir o detalhamento completo
                                    </p>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}
