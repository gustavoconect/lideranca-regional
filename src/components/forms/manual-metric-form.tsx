import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Calculator, Save, Calendar, Building2, Target, Percent, TrendingUp, Users, Info } from 'lucide-react'

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

    const npsValue = calculateNPS()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedUnitId || !weekDate || !responses) {
            toast.error('Preencha os campos obrigatórios (Unidade, Data e Total de Pesquisas).')
            return
        }

        setIsSubmitting(true)
        try {
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
                    nps_score: npsValue,
                    nps_semestral: parseFloat(npsSemestral) || null,
                    goal_2026_1: parseFloat(meta) || null,
                })

            if (error) throw error

            toast.success('Dados salvos com sucesso!')
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
        <Card className="bg-black/40 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
            <CardHeader className="p-10 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(240,185,11,0.1)]">
                        <Calculator className="h-7 w-7" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight text-white italic skew-x-[-10deg]">
                            Feeding <span className="text-primary">Manual</span>
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mt-1">Sincronização de métricas semanais de performance</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-10">
                <form onSubmit={handleSubmit} className="space-y-10">

                    {/* Tier 1: Core Config */}
                    <div className="grid md:grid-cols-2 gap-10 p-8 rounded-[2rem] bg-white/5 border border-white/5">
                        <div className="space-y-3">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                                <Building2 className="h-3.5 w-3.5" /> Unidade Operacional
                            </Label>
                            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                                <SelectTrigger className="bg-black/60 border-white/10 rounded-xl h-14 text-sm font-bold uppercase transition-all focus:border-primary/50 focus:ring-0 text-white shadow-2xl">
                                    <SelectValue placeholder="Selecione a unidade estratégica" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                    {units.map(u => (
                                        <SelectItem key={u.id} value={u.id} className="font-bold uppercase text-[11px] tracking-widest focus:bg-primary focus:text-black">
                                            {u.name} ({u.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                                <Calendar className="h-3.5 w-3.5" /> Data de Referência
                            </Label>
                            <Input
                                type="date"
                                value={weekDate}
                                onChange={e => setWeekDate(e.target.value)}
                                className="bg-black/60 border-white/10 rounded-xl h-14 text-sm font-bold uppercase focus:border-primary/50 focus:ring-0 text-white shadow-2xl"
                            />
                        </div>
                    </div>

                    {/* Tier 2: Goals & Volume */}
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                                <Percent className="h-3.5 w-3.5 text-primary" /> NPS Semestral
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="00.0"
                                    value={npsSemestral}
                                    onChange={e => setNpsSemestral(e.target.value)}
                                    className="bg-white/5 border-white/5 rounded-xl h-16 text-xl font-black tracking-tighter text-white focus:border-primary/50 transition-all pl-6"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20 uppercase tracking-widest">%</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                                <Target className="h-3.5 w-3.5 text-primary" /> Meta Semanal
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="00.0"
                                    value={meta}
                                    onChange={e => setMeta(e.target.value)}
                                    className="bg-white/5 border-white/5 rounded-xl h-16 text-xl font-black tracking-tighter text-primary focus:border-primary/50 transition-all pl-6 placeholder:text-primary/20"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/30 uppercase tracking-widest">GOAL</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-primary" /> Pesquisas Totais
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="000"
                                    value={responses}
                                    onChange={e => setResponses(e.target.value)}
                                    className="bg-white/5 border-white/5 rounded-xl h-16 text-xl font-black tracking-tighter text-white focus:border-primary/50 transition-all pl-6"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20 uppercase tracking-widest">RESP</span>
                            </div>
                        </div>
                    </div>

                    {/* Tier 3: Breakdown & Result */}
                    <div className="flex flex-col lg:flex-row gap-10 items-stretch border-t border-white/5 pt-10">
                        <div className="flex-1 grid sm:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    Promotores (9-10)
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={promoters}
                                    onChange={e => setPromoters(e.target.value)}
                                    className="bg-emerald-500/5 border-emerald-500/20 rounded-xl h-16 text-2xl font-black tracking-tighter text-emerald-500 focus:border-emerald-500/50 transition-all text-center"
                                />
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                    Detratores (0-6)
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={detractors}
                                    onChange={e => setDetractors(e.target.value)}
                                    className="bg-red-500/5 border-red-500/20 rounded-xl h-16 text-2xl font-black tracking-tighter text-red-500 focus:border-red-500/50 transition-all text-center"
                                />
                            </div>
                        </div>

                        <div className="lg:w-[350px] relative p-8 rounded-3xl bg-primary flex flex-col justify-center items-center shadow-2xl overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform">
                                <TrendingUp className="h-32 w-32 text-black" />
                            </div>
                            <span className="relative z-10 text-[11px] font-black uppercase tracking-[0.3em] text-black/60 mb-2">Calculated <span className="text-black">NPS</span></span>
                            <div className="relative z-10 flex items-baseline gap-2">
                                <span className="text-6xl font-black tracking-tighter text-black italic skew-x-[-5deg]">
                                    {npsValue.toFixed(1)}
                                </span>
                                <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">Points</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-6 bg-white/5 p-6 rounded-2xl border border-white/5 mt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                <Info className="h-5 w-5 text-white/30" />
                            </div>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider leading-relaxed max-w-lg">
                                Verifique cuidadosamente os valores antes de registrar. O NPS é calculado em tempo real com base nos promotores, detratores e volume total de pesquisas.
                            </p>
                        </div>
                        <Button
                            type="submit"
                            className="w-full md:w-64 h-16 bg-primary hover:bg-[#e0ad0a] text-black font-black uppercase text-[12px] tracking-[0.2em] rounded-xl shadow-[0_15px_35px_rgba(240,185,11,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] gap-3"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                'SYNCING...'
                            ) : (
                                <>
                                    <Save className="h-5 w-5" /> Registrar Dados
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
