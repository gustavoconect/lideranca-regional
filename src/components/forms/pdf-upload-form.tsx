'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, FileText, AlertCircle, CheckCircle, Info, Sparkles, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash' })

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
            console.log(`⏳ Rate limit atingido, aguardando ${waitTime / 1000}s antes de tentar novamente...`)
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

export function PdfUploadForm() {
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'idle' | 'extracting' | 'processing' | 'analyzing' | 'macro'>('idle')
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
    const [unitsFound, setUnitsFound] = useState<UnitData[] | null>(null)
    const [progress, setProgress] = useState<AnalysisProgress | null>(null)
    const [results, setResults] = useState<{ saved: number; skipped: string[] } | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const file = formData.get('pdf') as File

        if (!file) return

        setLoading(true)
        setStep('extracting')
        setUnitsFound(null)
        setProgress(null)
        setResults(null)

        try {
            // ETAPA 1: Extrair texto bruto do PDF
            console.log('📄 Extraindo texto do PDF...')
            const rawText = await extractTextFromPdf(file)
            console.log('📄 Texto extraído:', rawText.substring(0, 500) + '...')

            // ETAPA 2: Cortar por unidade usando Regex
            setStep('processing')
            console.log('✂️ Separando por unidade...')
            const unitTexts = splitTextByUnit(rawText)
            console.log(`✂️ Encontrados ${unitTexts.size} códigos de unidade`)

            if (unitTexts.size === 0) {
                toast.error('Nenhuma unidade encontrada no PDF. Verifique se o formato está correto.')
                setLoading(false)
                setStep('idle')
                return
            }

            // ETAPA 3 & 4: Sanitizar e cruzar com dados do CSV
            console.log('🔄 Cruzando com dados do banco...')
            const enrichedUnits = await enrichWithCsvData(unitTexts)
            setUnitsFound(enrichedUnits)

            if (enrichedUnits.length === 0) {
                toast.error('Nenhuma unidade do PDF foi encontrada no banco. Verifique os códigos.')
                setLoading(false)
                setStep('idle')
                return
            }

            // ETAPA 5: Analisar com IA
            setStep('analyzing')
            const unitsToAnalyze = enrichedUnits.filter(u => u.comments.length >= MIN_COMMENTS_FOR_ANALYSIS)

            let savedCount = 0
            const skippedUnits: string[] = []

            for (let i = 0; i < unitsToAnalyze.length; i++) {
                const unit = unitsToAnalyze[i]

                setProgress({
                    current: i + 1,
                    total: unitsToAnalyze.length,
                    currentUnit: unit.name
                })

                try {
                    console.log(`🧠 Analisando ${unit.name}...`)
                    console.log(`   📊 NPS: ${unit.currentNps}, Variação: ${unit.npsVariation}, Comentários: ${unit.comments.length}`)

                    const analysis = await analyzeWithGemini(unit)
                    console.log(`   ✅ Análise gerada (${analysis.length} chars)`)

                    // Buscar unit_id
                    const { data: unitRecord } = await supabase
                        .from('units')
                        .select('id')
                        .eq('code', unit.code)
                        .single()

                    if (unitRecord) {
                        const { error } = await supabase.from('qualitative_reports').insert({
                            unit_id: unitRecord.id,
                            report_date: reportDate,
                            ai_summary: {
                                type: 'unit',
                                unit_name: unit.name,
                                unit_code: unit.code,
                                feedback_count: unit.comments.length,
                                nps_score: unit.currentNps,
                                nps_variation: unit.npsVariation,
                                markdown_report: analysis,
                                priority_level: unit.currentNps === null ? 'media' :
                                    unit.currentNps < 50 ? 'critica' :
                                        unit.currentNps < 70 ? 'alta' : 'media'
                            }
                        })

                        if (!error) {
                            savedCount++
                            console.log(`✅ Relatório salvo: ${unit.name}`)
                        } else {
                            console.error(`❌ Erro ao salvar ${unit.name}:`, error)
                            skippedUnits.push(unit.name + ' (erro banco)')
                        }
                    }

                    // Delay de 1 segundo entre chamadas para evitar rate limit
                    if (i < unitsToAnalyze.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000))
                    }
                } catch (err: any) {
                    console.error(`❌ Erro ao analisar ${unit.name}:`, err)
                    console.error(`   Mensagem: ${err?.message || 'Desconhecido'}`)
                    console.error(`   Stack: ${err?.stack || 'N/A'}`)
                    skippedUnits.push(unit.name + ' (erro IA)')
                }
            }

            // Unidades sem comentários suficientes
            enrichedUnits
                .filter(u => u.comments.length < MIN_COMMENTS_FOR_ANALYSIS)
                .forEach(u => skippedUnits.push(`${u.name} (${u.comments.length} comentários)`))

            setResults({ saved: savedCount, skipped: skippedUnits })

            if (savedCount > 0) {
                // ETAPA FINAL: Gerar Relatório Macro Regional
                setStep('macro')
                console.log('🌎 Gerando análise macro regional...')
                try {
                    const regionalAnalysis = await analyzeRegionalMacro(enrichedUnits)
                    const totalFeedbacks = enrichedUnits.reduce((acc, u) => acc + u.feedbackCount, 0)
                    const avgNps = enrichedUnits.reduce((acc, u) => acc + (u.currentNps || 0), 0) / (enrichedUnits.filter(u => u.currentNps !== null).length || 1)

                    await supabase.from('qualitative_reports').insert({
                        unit_id: null, // Relatório Regional não tem unidade específica (Schema alterado para nullable)
                        report_date: reportDate,
                        ai_summary: {
                            type: 'regional',
                            total_feedbacks: totalFeedbacks,
                            overall_sentiment: avgNps >= 70 ? 'positivo' : avgNps >= 50 ? 'neutro' : 'negativo',
                            avg_nps: avgNps,
                            markdown_report: regionalAnalysis,
                            key_insight: 'Relatório Macro Regional Gerado com Sucesso'
                        }
                    })
                    console.log('✅ Relatório Regional salvo!')
                } catch (macroErr) {
                    console.error('Erro na análise macro:', macroErr)
                }

                toast.success(`Análise concluída! ${savedCount} relatórios salvos e visão macro gerada.`)
            } else {
                toast.warning('Nenhum relatório foi gerado. Verifique os logs.')
            }

        } catch (e: any) {
            console.error('Erro no pipeline:', e)
            toast.error('Erro: ' + e.message)
        } finally {
            setLoading(false)
            setStep('idle')
            setProgress(null)
        }
    }

    const getTrendIcon = (variation: number | null) => {
        if (variation === null) return <Minus className="h-4 w-4 text-gray-400" />
        if (variation > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
        if (variation < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
        return <Minus className="h-4 w-4 text-gray-400" />
    }

    return (
        <Card className="border-indigo-100 bg-indigo-50/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Análise Qualitativa (IA)
                </CardTitle>
                <CardDescription>
                    Upload PDF → Extrai comentários → Cruza com NPS → Analisa com IA
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="reportDate">Data de Referência</Label>
                        <Input
                            id="reportDate"
                            type="date"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="pdf">Arquivo PDF</Label>
                        <Input id="pdf" name="pdf" type="file" accept=".pdf" disabled={loading} required />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {step === 'extracting' ? 'Extraindo PDF...' :
                                    step === 'processing' ? 'Processando...' :
                                        'Analisando com IA...'}
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Iniciar Análise
                            </>
                        )}
                    </Button>
                </form>

                {/* Progress Bar */}
                {progress && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
                                Analisando: {progress.currentUnit}
                            </span>
                            <span>{progress.current}/{progress.total}</span>
                        </div>
                        <Progress value={(progress.current / progress.total) * 100} />
                    </div>
                )}

                {/* Units Found Preview */}
                {unitsFound && !progress && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            {unitsFound.length} unidades encontradas no banco:
                        </p>
                        <div className="grid gap-2 max-h-[250px] overflow-y-auto">
                            {unitsFound.map((unit, i) => (
                                <div key={i} className="flex items-center justify-between p-2 border rounded text-sm bg-white">
                                    <div className="flex items-center gap-2">
                                        {getTrendIcon(unit.npsVariation)}
                                        <span className="font-medium">{unit.name}</span>
                                        <span className="text-xs text-muted-foreground">({unit.code})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{unit.comments.length} comentários</Badge>
                                        {unit.currentNps !== null && (
                                            <Badge className={
                                                unit.currentNps >= 70 ? 'bg-green-100 text-green-800' :
                                                    unit.currentNps >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                            }>
                                                NPS {unit.currentNps.toFixed(0)}
                                            </Badge>
                                        )}
                                        {unit.comments.length >= MIN_COMMENTS_FOR_ANALYSIS ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="space-y-2">
                        {results.saved > 0 && (
                            <Alert>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription>
                                    {results.saved} relatórios salvos! <a href="/reports" className="underline font-medium">Ver Relatórios</a>
                                </AlertDescription>
                            </Alert>
                        )}
                        {results.skipped.length > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Não analisadas: {results.skipped.join(', ')}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
