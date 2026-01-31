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

    const filteredUnits = units.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-6 md:px-12 bg-background/80 border-b border-border backdrop-blur-2xl">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tighter text-foreground uppercase italic">Gestão de Ecossistema</h1>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Unidades, Líderes e Siglas</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge className="bg-primary/10 text-primary border-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                        ACESSO ADMINISTRATIVO
                    </Badge>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-12 gap-8 grid lg:grid-cols-12">
                {/* Formulário de Cadastro */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-slate-900 border-slate-800 rounded-[2rem] overflow-hidden sticky top-28">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary/20 text-primary">
                                    <Plus className="h-5 w-5" />
                                </div>
                                Nova Unidade
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Registre o núcleo da sua operação</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 pt-0">
                            <form onSubmit={handleCreateUnit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome da Unidade</Label>
                                    <Input
                                        placeholder="Ex: SÃO PAULO - CENTRO"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="bg-slate-950 border-slate-800 rounded-xl h-12 text-sm font-bold uppercase placeholder:text-slate-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sigla / ID Único</Label>
                                    <Input
                                        placeholder="Ex: SBRSPCBNF01"
                                        value={newCode}
                                        onChange={e => setNewCode(e.target.value)}
                                        className="bg-slate-950 border-slate-800 rounded-xl h-12 text-sm font-bold uppercase placeholder:text-slate-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Líder Responsável</Label>
                                    <Select value={newLeaderId} onValueChange={setNewLeaderId}>
                                        <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-12 text-sm font-bold uppercase">
                                            <SelectValue placeholder="Selecione um líder" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                                            {profiles.map(p => (
                                                <SelectItem key={p.id} value={p.id} className="focus:bg-primary focus:text-black">
                                                    {p.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full h-14 bg-primary hover:bg-primary/90 text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-lg shadow-primary/10 transition-all mt-6"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Processando...' : 'Confirmar Registro'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Listagem de Unidades */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-black tracking-tighter text-foreground uppercase italic">Frota de Unidades</h2>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">{units.length} bases operacionais ativas</p>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="BUSCAR UNIDADE/SIGLA..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-12 bg-muted border-border rounded-xl h-11 text-[10px] font-black tracking-widest placeholder:text-muted-foreground focus:ring-primary"
                            />
                        </div>
                    </div>

                    <ScrollArea className="h-[700px] rounded-[2.5rem]">
                        <div className="grid md:grid-cols-2 gap-4">
                            <AnimatePresence mode='popLayout'>
                                {filteredUnits.map((unit) => (
                                    <motion.div
                                        key={unit.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                    >
                                        <Card className="bg-slate-900 border-slate-800 hover:border-emerald-500/30 transition-all group rounded-[2rem] overflow-hidden relative shadow-2xl shadow-black/40">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="p-3 rounded-2xl bg-slate-950 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
                                                        <Building2 className="h-5 w-5" />
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteUnit(unit.id, unit.name)}
                                                        className="text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                <div className="space-y-4">
                                                    <div>
                                                        <h3 className="text-sm font-black text-white uppercase tracking-tight leading-none mb-1">{unit.name}</h3>
                                                        <div className="flex items-center gap-2">
                                                            <Hash className="h-3 w-3 text-primary" />
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{unit.code}</span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-slate-950 flex items-center justify-center text-slate-500">
                                                            <UserCircle2 className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Liderança</span>
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase truncate max-w-[150px]">
                                                                {unit.profiles?.full_name || 'PENDENTE'}
                                                            </span>
                                                        </div>
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

            <div className="p-8 max-w-7xl mx-auto w-full">
                <div className="p-6 bg-muted/30 rounded-[2.5rem] border border-border flex items-start gap-4">
                    <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-1" />
                    <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1 italic">Diretrizes de Governança</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed tracking-widest italic">
                            As siglas (ID Único) são utilizadas pelo motor de IA para cruzar os feedbacks dos usuários com os dados da unidade. Certifique-se de que a sigla cadastrada aqui seja idêntica à sigla que aparece nos relatórios PDF.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
