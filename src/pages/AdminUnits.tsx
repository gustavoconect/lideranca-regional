import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Building2, UserCircle2, Trash2, Plus, ShieldCheck, Search, Hash } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface Unit {
    id: string
    name: string
    code: string
    leader_id: string | null
    regional_group: string | null
    profiles?: {
        full_name: string
        email: string
    }
}

interface Profile {
    id: string
    full_name: string
    email: string
}

export default function AdminUnits() {
    const navigate = useNavigate()
    const [units, setUnits] = useState<Unit[]>([])
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [searchTerm, setSearchTerm] = useState('')

    // Form states
    const [newName, setNewName] = useState('')
    const [newCode, setNewCode] = useState('')
    const [newLeaderId, setNewLeaderId] = useState<string>('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const fetchData = async () => {
        try {
            const { data: unitsData, error: unitsError } = await supabase
                .from('units')
                .select('*, profiles (full_name, email)')
                .order('name')

            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('role', 'unit_leader')
                .order('full_name')

            if (unitsError) throw unitsError
            if (profilesError) throw profilesError

            setUnits(unitsData || [])
            setProfiles(profilesData || [])
        } catch (error: any) {
            toast.error('Erro ao buscar dados: ' + error.message)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleCreateUnit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName || !newCode) {
            toast.error('Preencha pelo menos o nome e a sigla.')
            return
        }

        setIsSubmitting(true)
        try {
            const { error } = await supabase
                .from('units')
                .insert({
                    name: newName.toUpperCase(),
                    code: newCode.toUpperCase(),
                    leader_id: newLeaderId || null
                })

            if (error) throw error

            toast.success('Unidade cadastrada com sucesso!')
            setNewName('')
            setNewCode('')
            setNewLeaderId('')
            fetchData()
        } catch (error: any) {
            toast.error('Erro ao cadastrar: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteUnit = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja remover a unidade "${name}"?`)) return

        try {
            const { error } = await supabase
                .from('units')
                .delete()
                .eq('id', id)

            if (error) throw error

            toast.success('Unidade removida.')
            setUnits(prev => prev.filter(u => u.id !== id))
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message)
        }
    }

    const handleUpdateLeader = async (unitId: string, leaderId: string) => {
        try {
            const { error } = await supabase
                .from('units')
                .update({ leader_id: leaderId === 'none' ? null : leaderId })
                .eq('id', unitId)

            if (error) throw error

            toast.success('Liderança atualizada com sucesso!')
            fetchData()
        } catch (error: any) {
            toast.error('Erro ao atualizar liderança: ' + error.message)
        }
    }

    const filteredUnits = units.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex min-h-screen w-full flex-col bg-black text-white font-sans selection:bg-primary selection:text-black">
            {/* Header Elite */}
            <header className="sticky top-0 z-50 flex h-20 items-center justify-between px-6 md:px-12 bg-black/60 border-b border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/dashboard')}
                        className="rounded-full hover:bg-white/10 text-white/50 hover:text-primary transition-all scale-110"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tight uppercase italic skew-x-[-10deg]">
                                Gestão de <span className="text-primary">Ecossistema</span>
                            </h1>
                            <Badge className="bg-primary text-black border-none px-2 py-0 text-[10px] font-black uppercase tracking-tighter rounded-sm">
                                V2.1 ELITE
                            </Badge>
                        </div>
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.4em] mt-1 pulse-slow">Governança e Configuração de Unidades</p>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Protocolo Seguro</span>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[11px] font-bold text-white/60 uppercase">Domínio Ativo</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 md:p-10 grid lg:grid-cols-12 gap-10">
                {/* Formulário de Cadastro - Coluna Esquerda */}
                <div className="lg:col-span-4 space-y-8">
                    <Card className="bg-black/40 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm sticky top-28 shadow-2xl shadow-black/60">
                        <CardHeader className="p-10 pb-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(240,185,11,0.1)]">
                                    <Plus className="h-7 w-7" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-black uppercase tracking-tight text-white italic skew-x-[-10deg]">
                                        Nova <span className="text-primary">Unidade</span>
                                    </CardTitle>
                                    <CardDescription className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mt-1">Expansão do núcleo operacional</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-10 pt-6">
                            <form onSubmit={handleCreateUnit} className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                                        <Building2 className="h-3.5 w-3.5" /> Nome da Unidade
                                    </Label>
                                    <Input
                                        placeholder="EX: SÃO PAULO - CENTRO"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="bg-black/60 border-white/10 rounded-xl h-14 text-sm font-bold uppercase transition-all focus:border-primary/50 focus:ring-0 text-white shadow-2xl placeholder:text-white/10"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                                        <Hash className="h-3.5 w-3.5" /> Sigla / Code Unique
                                    </Label>
                                    <Input
                                        placeholder="EX: SBRSPCENTRO01"
                                        value={newCode}
                                        onChange={e => setNewCode(e.target.value)}
                                        className="bg-black/60 border-white/10 rounded-xl h-14 text-sm font-bold uppercase transition-all focus:border-primary/50 focus:ring-0 text-white shadow-2xl placeholder:text-white/10"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                                        <UserCircle2 className="h-3.5 w-3.5" /> Líder Designado
                                    </Label>
                                    <Select value={newLeaderId} onValueChange={setNewLeaderId}>
                                        <SelectTrigger className="bg-black/60 border-white/10 rounded-xl h-14 text-sm font-bold uppercase transition-all focus:border-primary/50 focus:ring-0 text-white shadow-2xl">
                                            <SelectValue placeholder="Selecione o líder estratégico" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {profiles.map(p => (
                                                <SelectItem key={p.id} value={p.id} className="font-bold uppercase text-[11px] tracking-widest focus:bg-primary focus:text-black">
                                                    {p.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full h-16 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-[0.2em] italic text-sm rounded-xl border-none shadow-[0_10px_40px_rgba(240,185,11,0.2)] transition-all active:scale-[0.98] mt-6"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'SINCRONIZANDO...' : 'Confirmar Registro'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Listagem de Unidades - Coluna Direita */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary">
                                <Building2 className="h-7 w-7" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black tracking-tight text-white uppercase italic skew-x-[-10deg]">Níveis de <span className="text-primary">Operação</span></h2>
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em]">{units.length} bases monitoradas</p>
                            </div>
                        </div>
                        <div className="relative w-full sm:w-80 group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary group-focus-within:text-white transition-colors" />
                            <Input
                                placeholder="LOCALIZAR UNIDADE..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-14 bg-white/5 border-white/5 rounded-2xl h-14 text-[10px] font-black tracking-[0.2em] placeholder:text-white/20 focus:border-primary/50 transition-all uppercase"
                            />
                        </div>
                    </div>

                    <ScrollArea className="h-[calc(100vh-320px)] rounded-[3rem] px-4">
                        <div className="grid md:grid-cols-2 gap-6 pb-12">
                            <AnimatePresence mode='popLayout'>
                                {filteredUnits.map((unit) => (
                                    <motion.div
                                        key={unit.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="group"
                                    >
                                        <Card className="bg-white/5 border-white/5 group-hover:border-primary/30 transition-all duration-500 rounded-[2.5rem] overflow-hidden relative shadow-2xl backdrop-blur-sm">
                                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 group-hover:opacity-[0.07] transition-all">
                                                <Building2 className="h-40 w-40 text-white" />
                                            </div>

                                            <CardContent className="p-8">
                                                <div className="flex justify-between items-start mb-8">
                                                    <div className="flex flex-col">
                                                        <Badge variant="outline" className="w-fit mb-3 border-primary/20 text-primary text-[10px] font-black tracking-widest bg-primary/5">
                                                            ID: {unit.code}
                                                        </Badge>
                                                        <h3 className="text-lg font-black text-white uppercase tracking-tight italic group-hover:text-primary transition-colors">{unit.name}</h3>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteUnit(unit.id, unit.name)}
                                                        className="h-10 w-10 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>

                                                <div className="pt-6 border-t border-white/5 flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-primary shadow-inner">
                                                        <UserCircle2 className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">Comando Unitário</span>
                                                        <Select
                                                            defaultValue={unit.leader_id || 'none'}
                                                            onValueChange={(value) => handleUpdateLeader(unit.id, value)}
                                                        >
                                                            <SelectTrigger className="h-11 bg-black/40 border-white/10 rounded-xl text-[10px] font-black uppercase transition-all hover:border-primary/50 text-white/80">
                                                                <SelectValue placeholder="DESIGNAR LÍDER" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                                                <SelectItem value="none" className="font-bold uppercase text-[10px] tracking-widest focus:bg-primary focus:text-black">
                                                                    COMANDO VACANTE
                                                                </SelectItem>
                                                                {profiles.map(p => (
                                                                    <SelectItem key={p.id} value={p.id} className="font-bold uppercase text-[10px] tracking-widest focus:bg-primary focus:text-black">
                                                                        {p.full_name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
                </div>
            </main>

            {/* Footer de Governança */}
            <div className="p-10 max-w-[1600px] mx-auto w-full">
                <div className="relative overflow-hidden group p-10 rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 flex items-center gap-8 shadow-2xl">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(240,185,11,0.1),transparent)]" />
                    <div className="p-5 rounded-2xl bg-primary/20 text-primary border border-primary/20">
                        <ShieldCheck className="h-10 w-10" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-base font-black text-white uppercase tracking-widest italic mb-2">Integridade de Identificação Unificada</h3>
                        <p className="text-[11px] font-bold text-white/50 leading-relaxed uppercase tracking-wider max-w-[1000px]">
                            As siglas (ID Único) são os pontos de ancoragem do motor de IA para correlacionar feedbacks qualitativos (PDF) com dados transacionais. Inconsistency nestes códigos pode comprometer a precisão dos relatórios executivos.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
