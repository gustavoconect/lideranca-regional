'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Upload, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function CsvUploadForm({ onImportComplete }: { onImportComplete?: () => void }) {
    const [loading, setLoading] = useState(false)
    const [extractionDate, setExtractionDate] = useState(() => new Date().toISOString().split('T')[0])
    const [weekDate, setWeekDate] = useState(() => {
        const now = new Date()
        const monday = new Date(now)
        monday.setDate(now.getDate() - now.getDay() + 1)
        return monday.toISOString().split('T')[0]
    })

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        const reader = new FileReader()
        reader.onload = async ({ target }) => {
            if (!target?.result) return
            let csv = target.result as string

            // Remove BOM and Excel metadata
            csv = csv.replace(/^\uFEFF/, '')
            if (csv.startsWith('sep=')) {
                const lines = csv.split('\n')
                lines.shift()
                csv = lines.join('\n')
            }

            Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                delimiter: csv.includes(';') ? ';' : ',',
                complete: async (results) => {
                    try {
                        const validRows = results.data.filter((row: any) => {
                            return row['Empresa'] || row['Sigla'] || row['Nome']
                        })

                        if (validRows.length === 0) {
                            toast.error('Nenhum dado válido encontrado.')
                            setLoading(false)
                            return
                        }

                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) throw new Error('Usuário não autenticado')

                        // 1. Criar registro da fonte de dados
                        const { data: dataSource, error: sourceError } = await supabase
                            .from('data_sources')
                            .insert({
                                filename: file.name,
                                file_type: 'csv',
                                extraction_date: extractionDate,
                                created_by: user.id
                            })
                            .select()
                            .single()

                        if (sourceError) throw sourceError

                        let importedCount = 0

                        for (const row of validRows as any[]) {
                            const unitCode = row['Sigla']?.trim() || ''
                            const unitName = row['Nome']?.trim() || unitCode
                            const regionalGroup = row['Empresa']?.trim() || row['Grupo de unidades']?.trim() || ''

                            if (!unitCode) continue

                            // Get or Create Unit
                            let { data: unit } = await supabase
                                .from('units')
                                .select('id')
                                .eq('code', unitCode)
                                .single()

                            let unitId = unit?.id

                            if (!unitId) {
                                const { data: newUnit, error: createError } = await supabase
                                    .from('units')
                                    .insert({
                                        name: unitName,
                                        code: unitCode,
                                        leader_id: user.id,
                                        regional_group: regionalGroup
                                    })
                                    .select()
                                    .single()

                                if (createError) continue
                                unitId = newUnit.id
                            }

                            // Parse metrics
                            const parseMetric = (val: string) => {
                                if (!val) return 0
                                return parseFloat(val.replace('%', '').replace(',', '.').trim()) || 0
                            }
                            const parseIntMetric = (val: string) => {
                                if (!val) return 0
                                return parseInt(val.replace(/\D/g, ''), 10) || 0
                            }

                            const metricData = {
                                unit_id: unitId,
                                source_id: dataSource.id,
                                week_start_date: weekDate,
                                position_ranking: parseIntMetric(row['Pos.'] || row['Posição']),
                                responses_count: parseIntMetric(row['Resposta'] || row['Respostas']),
                                promoters_count: parseIntMetric(row['Promotores']),
                                detractors_count: parseIntMetric(row['Detratores']),
                                nps_score: parseMetric(row['NPS']),
                                goal_2026_1: parseMetric(row['Meta 2026/1'] || row['Meta'])
                            }

                            // No upsert here because we want to track by source. 
                            // If user uploads same week twice, it might duplicate unless we handle it.
                            // But for "Data Center" management, having one entry per source is better.
                            const { error } = await supabase
                                .from('nps_metrics')
                                .insert(metricData)

                            if (!error) importedCount++
                        }

                        toast.success(`Sucesso! ${importedCount} registros importados da fonte "${file.name}".`)
                        onImportComplete?.()

                    } catch (error: any) {
                        console.error('Import error:', error)
                        toast.error('Erro: ' + error.message)
                    } finally {
                        setLoading(false)
                    }
                },
                error: (error: Error) => {
                    toast.error('Erro ao ler CSV: ' + error.message)
                    setLoading(false)
                }
            })
        }
        reader.readAsText(file, 'UTF-8')
    }

    return (
        <Card className="bg-slate-900 border-slate-800 rounded-[2rem] overflow-hidden">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white uppercase italic tracking-tighter">
                    <Upload className="h-5 w-5 text-emerald-500" />
                    Upload de Métricas (CSV)
                </CardTitle>
                <CardDescription className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">
                    Importe o CSV do ranking NPS e registre a data de extração.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="extraction" className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-black">
                            <CalendarDays className="h-4 w-4" />
                            Data da Extração
                        </Label>
                        <Input
                            id="extraction"
                            type="date"
                            value={extractionDate}
                            onChange={(e) => setExtractionDate(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="week" className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-black">
                            <CalendarDays className="h-4 w-4" />
                            Semana de Referência
                        </Label>
                        <Input
                            id="week"
                            type="date"
                            value={weekDate}
                            onChange={(e) => setWeekDate(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="csv" className="text-slate-400 text-[10px] uppercase font-black">Arquivo CSV</Label>
                    <div className="relative">
                        <Input
                            id="csv"
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={loading}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl file:bg-emerald-500 file:text-slate-950 file:border-none file:rounded-lg file:px-4 file:mr-4 file:font-black file:uppercase file:text-[10px] h-12 flex items-center"
                        />
                        {loading && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-emerald-500 font-bold uppercase tracking-widest">
                                <Loader2 className="animate-spin h-4 w-4" />
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
