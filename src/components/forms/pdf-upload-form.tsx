'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Sparkles, Calendar, FileText, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import * as pdfjsLib from 'pdfjs-dist'

// Configurar worker do PDF.js para Vite
// @ts-ignore - Import do worker como URL
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

import { splitTextByUnit } from '@/utils/pdf-processing'

interface PdfUploadFormProps {
    onImportComplete?: () => void
}

/**
 * ETAPA 1: Extrai texto bruto do PDF usando PDF.js
 */
async function extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: true
    }).promise

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

// Funções de processamento de PDF migradas para @/utils/pdf-processing.ts

// Funções de análise removidas para desacoplamento. A análise agora ocorre em Reports.tsx


export function PdfUploadForm({ onImportComplete }: PdfUploadFormProps) {
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'idle' | 'extracting' | 'processing' | 'analyzing' | 'macro'>('idle')
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
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
        setResults(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Usuário não autenticado')

            const rawText = await extractTextFromPdf(file)

            const { error: sourceError } = await supabase
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
            // Validação visual rápida para o usuário
            const unitTexts = splitTextByUnit(rawText)

            setResults({ saved: unitTexts.size, skipped: [] })
            toast.success('Arquivo processado e salvo na Central de Dados com sucesso!')
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
                                    {step === 'extracting' ? 'Extraindo Conteúdo Bruto...' : 'Finalizando...'}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-5 w-5" />
                                <span>Extrair Dados & Salvar</span>
                            </div>
                        )}
                    </Button>
                </form>

                <AnimatePresence>
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
                                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Extração Concluída</span>
                                <p className="text-sm font-bold text-white uppercase tracking-tight">
                                    {results.saved} pesquisas identificadas no arquivo. Dados prontos para análise.
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

