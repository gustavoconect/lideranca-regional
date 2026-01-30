import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Calculator, Save, Calendar, Building2, Target, Percent } from 'lucide-react'

interface Unit {
    id: string
    name: string
    code: string
}

interface ManualMetricFormProps {
    onSave: () => void
}

export function ManualMetricForm({ onSave }: ManualMetricFormProps) {
    const [units, setUnits] = useState<Unit[]>([])
    const [selectedUnitId, setSelectedUnitId] = useState<string>('')
    const [weekDate, setWeekDate] = useState(new Date().toISOString().split('T')[0])

    // Metrics
    const [npsSemestral, setNpsSemestral] = useState('')
    const [meta, setMeta] = useState('')
    const [responses, setResponses] = useState('')
    const [promoters, setPromoters] = useState('')
    const [detractors, setDetractors] = useState('')

    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        const fetchUnits = async () => {
            const { data } = await supabase.from('units').select('id, name, code').order('name')
            setUnits(data || [])
        }
        fetchUnits()
    }, [])

    const calculateNPS = () => {
        const p = parseInt(promoters) || 0
        const d = parseInt(detractors) || 0
        const r = parseInt(responses) || 0
        if (r === 0) return 0
        return ((p - d) / r) * 100
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedUnitId || !weekDate || !responses) {
            toast.error('Preencha os campos obrigatórios (Unidade, Data e Total de Pesquisas).')
            return
        }

        setIsSubmitting(true)
        try {
            const npsScore = calculateNPS()

            // Gerar label da semana (ex: formatar a data para semana do ano)
            const date = new Date(weekDate)
            const weekLabel = `Semana de ${date.toLocaleDateString('pt-BR')}`

            const { error } = await supabase
                .from('nps_metrics')
                .insert({
                    unit_id: selectedUnitId,
                    week_start_date: weekDate,
                    week_label: weekLabel,
                    responses_count: parseInt(responses),
                    promoters_count: parseInt(promoters) || 0,
                    detractors_count: parseInt(detractors) || 0,
                    nps_score: npsScore,
                    nps_semestral: parseFloat(npsSemestral) || null,
                    goal_2026_1: parseFloat(meta) || null,
                    // source_id é null para entradas manuais
                })

            if (error) throw error

            toast.success('Dados salvos com sucesso!')
            // Limpar campos exceto unidade e data para facilitar próximas entradas
            setNpsSemestral('')
            setMeta('')
            setResponses('')
            setPromoters('')
            setDetractors('')
            onSave()
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card className="bg-slate-900 border-slate-800 rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-3 italic">
                    <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400">
                        <Calculator className="h-6 w-6" />
                    </div>
                    Alimentação Manual de Métricas
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Insira os indicadores semanais de performance</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Configuracoes Basicas */}
                    <div className="space-y-6 md:col-span-2 lg:col-span-3 pb-6 border-b border-slate-800 grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Building2 className="h-3 w-3 text-indigo-500" /> Unidade Operacional
                            </Label>
                            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-14 text-sm font-bold uppercase transition-all focus:ring-2 focus:ring-indigo-500/50">
                                    <SelectValue placeholder="Escolha a unidade..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                                    {units.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name} ({u.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-indigo-500" /> Data de Referência
                            </Label>
                            <Input
                                type="date"
                                value={weekDate}
                                onChange={e => setWeekDate(e.target.value)}
                                className="bg-slate-950 border-slate-800 rounded-xl h-14 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>

                    {/* Metas e Historico */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Percent className="h-3 w-3 text-indigo-500" /> NPS Semestral
                        </Label>
                        <Input
                            type="number"
                            step="0.1"
                            placeholder="75.0"
                            value={npsSemestral}
                            onChange={e => setNpsSemestral(e.target.value)}
                            className="bg-slate-950 border-slate-800 rounded-xl h-14 text-lg font-black tracking-tight"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Target className="h-3 w-3 text-emerald-500" /> Meta NPS Semanal
                        </Label>
                        <Input
                            type="number"
                            step="0.1"
                            placeholder="80.0"
                            value={meta}
                            onChange={e => setMeta(e.target.value)}
                            className="bg-slate-950 border-slate-800 rounded-xl h-14 text-lg font-black tracking-tight text-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            Total de Pesquisas
                        </Label>
                        <Input
                            type="number"
                            placeholder="150"
                            value={responses}
                            onChange={e => setResponses(e.target.value)}
                            className="bg-slate-950 border-slate-800 rounded-xl h-14 text-lg font-black tracking-tight"
                        />
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-2 lg:col-start-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                            Promotores (9-10)
                        </Label>
                        <Input
                            type="number"
                            placeholder="120"
                            value={promoters}
                            onChange={e => setPromoters(e.target.value)}
                            className="bg-emerald-500/5 border-emerald-500/20 rounded-xl h-14 text-lg font-black tracking-tight text-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                            Detratores (0-6)
                        </Label>
                        <Input
                            type="number"
                            placeholder="10"
                            value={detractors}
                            onChange={e => setDetractors(e.target.value)}
                            className="bg-red-500/5 border-red-500/20 rounded-xl h-14 text-lg font-black tracking-tight text-red-500"
                        />
                    </div>

                    <div className="md:col-span-2 lg:col-span-3 pt-6 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-800 mt-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">Cálculo de NPS Estimado</span>
                            <span className="text-3xl font-black tracking-tighter text-white italic">
                                {calculateNPS().toFixed(1)} <span className="text-[10px] tracking-normal not-italic font-bold text-slate-600 ml-1">POINTS</span>
                            </span>
                        </div>
                        <Button
                            className="w-full md:w-64 h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-2xl shadow-indigo-600/20 transition-all gap-3"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                'Processando...'
                            ) : (
                                <>
                                    <Save className="h-4 w-4" /> Registrar Semana
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
