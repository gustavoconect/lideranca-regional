'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Sparkles, Calendar, FileText, Info } from 'lucide-react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import * as pdfjsLib from 'pdfjs-dist'

// Configurar worker do PDF.js para Vite
// @ts-ignore - Import do worker como URL
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || '')

const MIN_COMMENTS_FOR_ANALYSIS = 3

// Padrão Regex para identificar códigos de unidade (SBRSP seguido de letras e números)
const UNIT_CODE_PATTERN = /SBRSP[A-Z0-9]+/g

interface UnitData {
    code: string
    name: string
    comments: string[]
    // Dados do CSV (banco)
    currentNps: number | null
    previousNps: number | null
    npsVariation: number | null
    feedbackCount: number
}

interface AnalysisProgress {
    current: number
    total: number
    currentUnit: string
}

interface PdfUploadFormProps {
    onImportComplete?: () => void
}

/**
 * ETAPA 1: Extrai texto bruto do PDF usando PDF.js
 */
async function extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
        fullText += pageText + '\n'
    }

    return fullText
}

/**
 * ETAPA 2: Corta o texto por código de unidade usando Regex
 */
function splitTextByUnit(rawText: string): Map<string, string> {
    const unitTexts = new Map<string, string>()

    // Encontrar todas as ocorrências de códigos de unidade
    const matches = [...rawText.matchAll(UNIT_CODE_PATTERN)]

    if (matches.length === 0) {
        console.warn('Nenhum código de unidade encontrado no PDF')
        return unitTexts
    }

    // Para cada código encontrado, extrair o texto até o próximo código
    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i]
        const nextMatch = matches[i + 1]

        const startIndex = currentMatch.index!
        const endIndex = nextMatch ? nextMatch.index! : rawText.length

        const unitCode = currentMatch[0]
        const unitText = rawText.slice(startIndex, endIndex)

        // Acumular texto se o código já existir
        if (unitTexts.has(unitCode)) {
            unitTexts.set(unitCode, unitTexts.get(unitCode) + ' ' + unitText)
        } else {
            unitTexts.set(unitCode, unitText)
        }
    }

    return unitTexts
}

/**
 * ETAPA 3: Limpa/Sanitiza o texto extraído
 */
function sanitizeComments(rawText: string): string[] {
    // Remover o código da unidade do início
    let cleanText = rawText.replace(UNIT_CODE_PATTERN, '')

    // Remover datas (DD/MM/YY ou DD/MM/YYYY)
    cleanText = cleanText.replace(/\d{2}\/\d{2}\/\d{2,4}/g, '')

    // Remover horários (HH:MM ou HH:MM:SS)
    cleanText = cleanText.replace(/\d{2}:\d{2}(:\d{2})?/g, '')

    // Remover textos de sistema
    const systemTexts = [
        'Feedback 1:', 'Feedback 2:', 'Feedback 3:', 'Feedback 4:', 'Feedback 5:',
        'Cliente não autorizou contato',
        'Sem contato',
        'Comentário:',
        'Comentário',
        'NPS:',
        'Nota:',
        'Data:',
        'Unidade:',
        'Cliente:',
        'CPF:',
        'E-mail:',
        'Telefone:',
    ]

    systemTexts.forEach(text => {
        cleanText = cleanText.replace(new RegExp(text, 'gi'), '')
    })

    // Dividir por quebras de linha ou múltiplos espaços
    const potentialComments = cleanText
        .split(/[\n\r]+|\s{3,}/)
        .map(c => c.trim())
        .filter(c => c.length > 10) // Comentários muito curtos provavelmente são ruído
        .filter(c => !/^\d+$/.test(c)) // Remover textos que são apenas números
        .filter(c => !c.match(/^(Promotor|Detrator|Neutro)$/i)) // Remover classificações

    // Remover duplicatas
    return [...new Set(potentialComments)]
}

/**
 * ETAPA 4: Cruza dados do PDF com dados do CSV (banco)
 */
async function enrichWithCsvData(unitTexts: Map<string, string>): Promise<UnitData[]> {
    const enrichedUnits: UnitData[] = []

    for (const [code, rawText] of unitTexts) {
        // Buscar unidade no banco pelo código
        const { data: unitRecord } = await supabase
            .from('units')
            .select('id, name, code')
            .eq('code', code)
            .single()

        if (!unitRecord) {
            console.warn(`Unidade não encontrada no banco: ${code}`)
            continue
        }

        // Buscar métricas NPS mais recentes (últimas 2 semanas para calcular variação)
        const { data: npsRecords } = await supabase
            .from('nps_metrics')
            .select('nps_score, week_start_date, responses_count')
            .eq('unit_id', unitRecord.id)
            .order('week_start_date', { ascending: false })
            .limit(2)

        const currentNps = npsRecords?.[0]?.nps_score ?? null
        const previousNps = npsRecords?.[1]?.nps_score ?? null
        const feedbackCount = npsRecords?.[0]?.responses_count ?? 0

        let npsVariation: number | null = null
        if (currentNps !== null && previousNps !== null) {
            npsVariation = currentNps - previousNps
        }

        // Sanitizar comentários
        const comments = sanitizeComments(rawText)

        enrichedUnits.push({
            code,
            name: unitRecord.name,
            comments,
            currentNps,
            previousNps,
            npsVariation,
            feedbackCount
        })
    }

    return enrichedUnits
}

/**
 * ETAPA 5: Monta dossiê e envia para Gemini
 */
async function analyzeWithGemini(unit: UnitData, retryCount = 0): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    // Construir contexto numérico
    let npsContext = ''
    if (unit.currentNps !== null) {
        npsContext = `NPS ATUAL: ${unit.currentNps.toFixed(1)}`

        if (unit.npsVariation !== null) {
            if (unit.npsVariation > 0) {
                npsContext += ` (SUBIU ${unit.npsVariation.toFixed(1)} pontos)`
            } else if (unit.npsVariation < 0) {
                npsContext += ` (CAIU ${Math.abs(unit.npsVariation).toFixed(1)} pontos)`
            } else {
                npsContext += ' (ESTÁVEL)'
            }
        }
    } else {
        npsContext = 'NPS: Dados não disponíveis'
    }

    // Montar dossiê
    const dossiê = `# ANÁLISE CX - ${unit.name} (${unit.code})

## CONTEXTO NUMÉRICO (SINTOMA)
${npsContext}
Total de feedbacks no período: ${unit.feedbackCount}
Comentários extraídos do PDF: ${unit.comments.length}

## EVIDÊNCIAS (COMENTÁRIOS DOS ALUNOS)
${unit.comments.length > 0 ? unit.comments.map((c, i) => `${i + 1}. "${c}"`).join('\n') : 'Nenhum comentário extraído.'}

## SUA TAREFA
Você é um Especialista Sênior em Customer Experience para a rede de unidades Regionais.
Baseado na variação do NPS (extraído do CSV) E nos comentários (extraídos do PDF):

1. **Cruzamento de Dados**: Valide se os comentários realmente pertencem à unidade em questão buscando referências à sigla "${unit.code}" ou ao nome "${unit.name}" no contexto.
2. **Diagnóstico Estratégico**: O que explica a variação (ou estabilidade) da nota? Conecte o sintoma numérico com a evidência textual.
3. **Problema Raiz**: Qual é o principal ofensor identificado nos comentários dos alunos?
4. **Ação Recomendada**: Prescreva uma ação prática e imediata para o gerente da unidade.

REGRAS CRÍTICAS:
- Seja EXECUTIVO e DIRETO.
- Mencione se o NPS está acima ou abaixo da meta de 75.
- Se a nota SUBIU, identifique o que está funcionando bem.
- Se a nota CAIU, identifique a causa raiz de forma implacável.
- Máximo 150 palavras.
- Use **negrito** para destacar pontos críticos.`

    try {
        const result = await model.generateContent(dossiê)
        return result.response.text()
    } catch (error: any) {
        // Retry automático em caso de rate limit (429)
        if (error?.message?.includes('429') && retryCount < 3) {
            const waitTime = Math.pow(2, retryCount + 1) * 5000 // 10s, 20s, 40s
            // Rate limit handled
            await new Promise(resolve => setTimeout(resolve, waitTime))
            return analyzeWithGemini(unit, retryCount + 1)
        }
        throw error
    }
}

/**
 * ETAPA 6: Gera Relatório Macro Regional (Consolidado)
 */
async function analyzeRegionalMacro(allUnits: UnitData[], retryCount = 0): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash' })

    const totalFeedbacks = allUnits.reduce((acc, u) => acc + u.feedbackCount, 0)
    const avgNps = allUnits.reduce((acc, u) => acc + (u.currentNps || 0), 0) / (allUnits.filter(u => u.currentNps !== null).length || 1)

    // Coleta 2 comentários mais críticos de cada unidade para o dossiê regional
    const regionalEvidences = allUnits
        .filter(u => u.comments.length > 0)
        .map(u => `UNIDADE ${u.name}:\n${u.comments.slice(0, 2).map(c => `- "${c}"`).join('\n')}`)
        .join('\n\n')

    const prompt = `Atue como Gerente Regional de CX. Analise o desempenho GERAL da regional nesta semana.

DADOS CONSOLIDADOS:
- Total de Feedbacks: ${totalFeedbacks}
- NPS Médio Regional: ${avgNps.toFixed(1)}
- Unidades Analisadas: ${allUnits.length}

EVIDÊNCIAS POR UNIDADE:
${regionalEvidences}

TAREFA:
Gere um relatório Executivo Macro (Markdown) com:
1. **Panorama Geral**: Resumo do clima da regional.
2. **Padrões Identificados**: Problemas térmicos, de atendimento ou infraestrutura que se repetem em várias unidades?
3. **Destaque Positivo**: Qual unidade/área está sendo o motor da regional?
4. **Foco Estratégico**: Qual deve ser a prioridade do líder regional na próxima semana?

REGRAS:
- Linguagem EXECUTIVA e TÁTICA.
- Máximo 250 palavras.
- Use **negrito** para pontos de atenção.`

    try {
        const result = await model.generateContent(prompt)
        return result.response.text()
    } catch (error: any) {
        if (error?.message?.includes('429') && retryCount < 3) {
            const waitTime = Math.pow(2, retryCount + 1) * 5000
            await new Promise(resolve => setTimeout(resolve, waitTime))
            return analyzeRegionalMacro(allUnits, retryCount + 1)
        }
        throw error
    }
}

export function PdfUploadForm({ onImportComplete }: PdfUploadFormProps) {
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'idle' | 'extracting' | 'processing' | 'analyzing' | 'macro'>('idle')
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
    const [progress, setProgress] = useState<AnalysisProgress | null>(null)
    const [results, setResults] = useState<{ saved: number; skipped: string[] } | null>(null)
    const [fileName, setFileName] = useState<string>('')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) setFileName(file.name)
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const file = formData.get('pdf') as File

        if (!file) {
            toast.error('Por favor, selecione um arquivo PDF.')
            return
        }

        setLoading(true)
        setStep('extracting')
        setProgress(null)
        setResults(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Usuário não autenticado')

            const rawText = await extractTextFromPdf(file)

            const { data: dataSource, error: sourceError } = await supabase
                .from('data_sources')
                .insert({
                    filename: file.name,
                    file_type: 'pdf',
                    extraction_date: reportDate,
                    created_by: user.id,
                    extracted_text: rawText
                })
                .select()
                .single()

            if (sourceError) throw sourceError

            setStep('processing')
            const unitTexts = splitTextByUnit(rawText)

            if (unitTexts.size === 0) {
                toast.error('Nenhuma unidade encontrada no PDF.')
                setLoading(false)
                setStep('idle')
                return
            }

            const enrichedUnits = await enrichWithCsvData(unitTexts)

            setStep('analyzing')
            const unitsToAnalyze = enrichedUnits.filter(u => u.comments.length >= MIN_COMMENTS_FOR_ANALYSIS)

            let savedCount = 0
            const skippedUnits: string[] = []

            for (let i = 0; i < unitsToAnalyze.length; i++) {
                const unit = unitsToAnalyze[i]
                setProgress({ current: i + 1, total: unitsToAnalyze.length, currentUnit: unit.name })

                try {
                    const analysis = await analyzeWithGemini(unit)
                    const { data: unitRecord } = await supabase
                        .from('units')
                        .select('id')
                        .eq('code', unit.code)
                        .single()

                    if (unitRecord) {
                        await supabase.from('qualitative_reports').insert({
                            unit_id: unitRecord.id,
                            source_id: dataSource.id,
                            report_date: reportDate,
                            ai_summary: {
                                type: 'unit',
                                unit_name: unit.name,
                                unit_code: unit.code,
                                feedback_count: unit.comments.length,
                                nps_score: unit.currentNps,
                                nps_variation: unit.npsVariation,
                                markdown_report: analysis,
                                priority_level: unit.currentNps === null ? 'média' :
                                    unit.currentNps < 50 ? 'alta' :
                                        unit.currentNps < 70 ? 'média' : 'baixa'
                            }
                        })
                        savedCount++
                    }
                    if (i < unitsToAnalyze.length - 1) await new Promise(r => setTimeout(r, 1000))
                } catch (err) {
                    skippedUnits.push(unit.name)
                }
            }

            setStep('macro')
            const regionalAnalysis = await analyzeRegionalMacro(enrichedUnits)
            const totalFeedbacks = enrichedUnits.reduce((acc, u) => acc + u.feedbackCount, 0)
            const avgNps = enrichedUnits.reduce((acc, u) => acc + (u.currentNps || 0), 0) / (enrichedUnits.filter(u => u.currentNps !== null).length || 1)

            await supabase.from('qualitative_reports').insert({
                unit_id: null,
                source_id: dataSource.id,
                report_date: reportDate,
                ai_summary: {
                    type: 'regional',
                    total_feedbacks: totalFeedbacks,
                    overall_sentiment: avgNps >= 70 ? 'positivo' : avgNps >= 50 ? 'neutro' : 'negativo',
                    avg_nps: avgNps,
                    markdown_report: regionalAnalysis,
                    key_insight: 'Relatório Macro Regional Gerado'
                }
            })

            setResults({ saved: savedCount, skipped: skippedUnits })
            toast.success('Processamento de PDF concluído!')
            onImportComplete?.()

        } catch (e: any) {
            toast.error('Erro: ' + e.message)
        } finally {
            setLoading(false)
            setStep('idle')
        }
    }

    return (
        <Card className="bg-black/40 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
            <CardHeader className="p-10 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(240,185,11,0.1)]">
                        <Sparkles className="h-7 w-7" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight text-white italic skew-x-[-10deg]">
                            Intelligence <span className="text-primary">Knowledge</span>
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mt-1">Análise qualitativa profunda via Gemini 3 Flash</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-10 pt-4 space-y-10">
                <form onSubmit={handleSubmit} className="space-y-10">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label htmlFor="reportDate" className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Data de Referência
                            </Label>
                            <Input
                                id="reportDate"
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="h-16 bg-black/60 border-white/10 text-white rounded-xl focus:border-primary/50 focus:ring-0 shadow-2xl text-sm font-bold uppercase transition-all"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Fonte de Dados (PDF)
                            </Label>
                            <div className="relative group">
                                <Input
                                    id="pdf"
                                    name="pdf"
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    disabled={loading}
                                    className="hidden"
                                />
                                <Label
                                    htmlFor="pdf"
                                    className={`flex flex-col items-center justify-center h-16 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${fileName
                                        ? 'bg-primary/20 border-primary shadow-[0_0_20px_rgba(240,185,11,0.1)]'
                                        : 'bg-white/5 border-white/10 hover:border-primary/50 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <FileText className={`h-5 w-5 ${fileName ? 'text-primary animate-pulse' : 'text-white/40'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${fileName ? 'text-white' : 'text-white/40'}`}>
                                            {fileName || 'Selecionar PDF Estratégico'}
                                        </span>
                                    </div>
                                </Label>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-16 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-[0.2em] italic text-sm rounded-2xl border-none shadow-[0_10px_40px_rgba(240,185,11,0.2)] transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>
                                    {step === 'extracting' ? 'Extracação Bruta...' :
                                        step === 'processing' ? 'Cruzamento CSV...' :
                                            step === 'analyzing' ? 'IA: Unidades...' :
                                                'IA: Visão Regional...'}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-5 w-5" />
                                <span>Iniciar Processamento de Elite</span>
                            </div>
                        )}
                    </Button>
                </form>

                <AnimatePresence>
                    {progress && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4 bg-white/5 p-8 rounded-3xl border border-white/5"
                        >
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Deep Analysis</span>
                                    <span className="text-lg font-black text-white uppercase italic">{progress.currentUnit}</span>
                                </div>
                                <span className="text-2xl font-black text-primary italic">
                                    {Math.round((progress.current / progress.total) * 100)}%
                                </span>
                            </div>
                            <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="absolute top-0 left-0 h-full bg-primary"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/30">
                                <span>Módulo: {step}</span>
                                <span>{progress.current} de {progress.total} unidades</span>
                            </div>
                        </motion.div>
                    )}

                    {results && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-6"
                        >
                            <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-500">
                                <CheckCircle className="h-8 w-8" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Upload de Sucesso</span>
                                <p className="text-sm font-bold text-white uppercase tracking-tight">
                                    {results.saved} registros qualitativos processados e integrados à Regional.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Dicas de Elite */}
                {!loading && !results && (
                    <div className="pt-6 border-t border-white/5 flex gap-10">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest">
                                <Info className="h-3 w-3" /> Tip: Formato Ideal
                            </div>
                            <p className="text-[10px] font-medium text-white/20 uppercase tracking-wide leading-relaxed">
                                Certifique-se de que o PDF contém os códigos SBRSP para garantir a precisão do mapeamento por unidade.
                            </p>
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest">
                                <Info className="h-3 w-3" /> Tip: IA Analítica
                            </div>
                            <p className="text-[10px] font-medium text-white/20 uppercase tracking-wide leading-relaxed">
                                O processamento leva em média 3-5 segundos por unidade para garantir insights de alta qualidade.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

