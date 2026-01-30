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
                        console.log('CSV Headers:', results.meta.fields)
                        console.log('First Row Sample:', results.data[0])

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

                        let importedCount = 0
                        let updatedCount = 0

                        for (const row of validRows as any[]) {
                            // MAPEAMENTO CORRETO:
                            // Sigla = código único (SBRSPCBUT01)
                            // Nome = nome REAL da unidade (Butantã, Rio Pequeno)
                            // Empresa = nome da regional (SP15 - Alex Ribeiro)
                            const unitCode = row['Sigla']?.trim() || ''
                            const unitName = row['Nome']?.trim() || unitCode  // NOME é o nome da unidade!
                            const regionalGroup = row['Empresa']?.trim() || row['Grupo de unidades']?.trim() || ''

                            if (!unitCode) {
                                console.warn('Skipping row without Sigla:', row)
                                continue
                            }

                            // Check if unit exists
                            const { data: existingUnit } = await supabase
                                .from('units')
                                .select('id')
                                .eq('code', unitCode)
                                .single()

                            let unitId = existingUnit?.id

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

                                if (createError) {
                                    console.error('Error creating unit:', unitCode, createError)
                                    continue
                                }
                                unitId = newUnit.id
                            }

                            // Parse metrics - Brazilian format
                            const parseMetric = (val: string) => {
                                if (!val) return 0
                                return parseFloat(val.replace('%', '').replace(',', '.').trim()) || 0
                            }
                            const parseIntMetric = (val: string) => {
                                if (!val) return 0
                                return parseInt(val.replace(/\D/g, ''), 10) || 0
                            }

                            // Check if metric for this week already exists
                            const { data: existingMetric } = await supabase
                                .from('nps_metrics')
                                .select('id')
                                .eq('unit_id', unitId)
                                .eq('week_start_date', weekDate)
                                .single()

                            const metricData = {
                                unit_id: unitId,
                                week_start_date: weekDate,
                                position_ranking: parseIntMetric(row['Pos.'] || row['Posição']),
                                responses_count: parseIntMetric(row['Resposta'] || row['Respostas']),
                                promoters_count: parseIntMetric(row['Promotores']),
                                detractors_count: parseIntMetric(row['Detratores']),
                                nps_score: parseMetric(row['NPS']),
                                goal_2026_1: parseMetric(row['Meta 2026/1'] || row['Meta'])
                            }

                            if (existingMetric) {
                                const { error } = await supabase
                                    .from('nps_metrics')
                                    .update(metricData)
                                    .eq('id', existingMetric.id)

                                if (!error) updatedCount++
                            } else {
                                const { error } = await supabase
                                    .from('nps_metrics')
                                    .insert(metricData)

                                if (!error) importedCount++
                            }
                        }

                        const message = updatedCount > 0
                            ? `Sucesso! ${importedCount} novos, ${updatedCount} atualizados.`
                            : `Sucesso! ${importedCount} registros importados.`

                        toast.success(message)
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload de Métricas (CSV)
                </CardTitle>
                <CardDescription>
                    Importe o CSV do ranking NPS. Selecione a data da semana.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="week" className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Data da Semana
                    </Label>
                    <Input
                        id="week"
                        type="date"
                        value={weekDate}
                        onChange={(e) => setWeekDate(e.target.value)}
                        disabled={loading}
                    />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="csv">Arquivo CSV</Label>
                    <Input
                        id="csv"
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={loading}
                    />
                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="animate-spin h-4 w-4" /> Processando...
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
