import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Minimize2, CheckCircle, ChevronRight, Calendar, ClipboardList, Camera, ShieldAlert, Loader2, AlertCircle, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Task {
    id: string
    title: string
    description: string
    due_date: string
    status: 'pending' | 'completed' | 'late' | 'verified'
    priority: 'low' | 'medium' | 'high' | 'critical'
    validation_type: 'checkbox' | 'photo' | 'text'
    proof_url: string | null
    completed_at: string | null
    created_at: string
    unit_leader_id: string
    profiles?: { full_name: string; email: string }
}

interface Unit {
    id: string
    name: string
    code: string
    leader_id: string
}

export default function TasksPage() {
    const navigate = useNavigate()
    const [tasks, setTasks] = useState<Task[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [showForm, setShowForm] = useState(false)

    // Form state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [priority, setPriority] = useState<string>('medium')
    const [requiresEvidence, setRequiresEvidence] = useState(false)
    const [selectedUnit, setSelectedUnit] = useState<string>('')

    useEffect(() => {
        checkAuth()
        fetchTasks()
        fetchUnits()
    }, [])

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) navigate('/login')
    }

    const fetchTasks = async () => {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('due_date', { ascending: true })

        if (error) {
            console.error('Error fetching tasks:', error)
        } else {
            setTasks(data || [])
        }
        setLoading(false)
    }

    const fetchUnits = async () => {
        const { data } = await supabase
            .from('units')
            .select('id, name, code, leader_id')
            .order('name')

        setUnits(data || [])
    }

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Find unit leader
            const unit = units.find(u => u.id === selectedUnit)

            const { error } = await supabase.from('tasks').insert({
                title,
                description,
                due_date: dueDate,
                priority,
                validation_type: requiresEvidence ? 'photo' : 'checkbox',
                regional_leader_id: user.id,
                unit_leader_id: unit?.leader_id || user.id,
                status: 'pending'
            })

            if (error) throw error

            toast.success('Tarefa criada com sucesso!')
            resetForm()
            fetchTasks()
        } catch (error: any) {
            toast.error('Erro ao criar tarefa: ' + error.message)
        } finally {
            setCreating(false)
        }
    }

    const resetForm = () => {
        setTitle('')
        setDescription('')
        setDueDate('')
        setPriority('medium')
        setRequiresEvidence(false)
        setSelectedUnit('')
        setShowForm(false)
    }

    const getStatusBadge = (task: Task) => {
        const isLate = new Date(task.due_date) < new Date() && task.status === 'pending'

        if (isLate) return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Atrasada</Badge>
        if (task.status === 'completed') return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Concluída</Badge>
        if (task.status === 'verified') return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="h-3 w-3 mr-1" />Verificada</Badge>
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
    }

    const getPriorityBadge = (priority: string) => {
        const colors: Record<string, string> = {
            low: 'bg-gray-100 text-gray-800',
            medium: 'bg-yellow-100 text-yellow-800',
            high: 'bg-orange-100 text-orange-800',
            critical: 'bg-red-100 text-red-800'
        }
        const labels: Record<string, string> = {
            low: 'Baixa',
            medium: 'Média',
            high: 'Alta',
            critical: 'Crítica'
        }
        return <Badge className={colors[priority]}>{labels[priority]}</Badge>
    }

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#0F172A] text-slate-200">
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-6 md:px-12 glass-dark border-b border-slate-800/50 backdrop-blur-2xl">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">Critical Operations</h1>
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em]">Action & Responsibility Matrix</p>
                    </div>
                </div>
                <Button
                    onClick={() => setShowForm(!showForm)}
                    className={`h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all duration-500 shadow-2xl ${showForm ? 'bg-slate-800 text-white' : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/10'}`}
                >
                    {showForm ? <Minimize2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {showForm ? 'Close Matrix' : 'Deploy Action'}
                </Button>
            </header>

            <main className="flex flex-1 flex-col gap-8 p-6 md:p-12 max-w-7xl mx-auto w-full">
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.98 }}
                            className="overflow-hidden"
                        >
                            <Card className="border-none shadow-2xl bg-slate-900 ring-1 ring-slate-800 rounded-[2.5rem] p-4">
                                <CardHeader className="pb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                                            <ShieldAlert className="h-6 w-6" />
                                        </div>
                                        <div className="flex flex-col">
                                            <CardTitle className="text-2xl font-black tracking-tighter text-white uppercase">Operational Directive</CardTitle>
                                            <CardDescription className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Define target and strategic objective</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateTask} className="grid gap-8 md:grid-cols-2">
                                        <div className="space-y-3">
                                            <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Objective Title</Label>
                                            <Input
                                                id="title"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                className="h-14 bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-700 rounded-2xl focus:ring-amber-500/20"
                                                placeholder="EX: BRAND CONSISTENCY AUDIT"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="unit" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Deployment Target</Label>
                                            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                                                <SelectTrigger className="h-14 bg-slate-950/50 border-slate-800 rounded-2xl focus:ring-amber-500/20">
                                                    <SelectValue placeholder="SELECT UNIT..." />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                                                    {units.map(unit => (
                                                        <SelectItem key={unit.id} value={unit.id} className="font-bold uppercase text-[10px] tracking-widest">{unit.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-3 md:col-span-2">
                                            <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Technical Specifications</Label>
                                            <Textarea
                                                id="description"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="bg-slate-950/50 border-slate-800 text-white min-h-[120px] rounded-[2rem] p-6 placeholder:text-slate-700"
                                                placeholder="ENTER DETAILED OPERATIONAL INSTRUCTIONS..."
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-6 md:col-span-2">
                                            <div className="space-y-3">
                                                <Label htmlFor="dueDate" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Deadline Horizon</Label>
                                                <Input
                                                    id="dueDate"
                                                    type="date"
                                                    value={dueDate}
                                                    onChange={(e) => setDueDate(e.target.value)}
                                                    className="h-14 bg-slate-950/50 border-slate-800 text-white rounded-2xl focus:ring-amber-500/20 invert"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="priority" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Impact Level</Label>
                                                <Select value={priority} onValueChange={setPriority}>
                                                    <SelectTrigger className="h-14 bg-slate-950/50 border-slate-800 rounded-2xl focus:ring-amber-500/20">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                                                        <SelectItem value="low" className="uppercase text-[10px] font-bold">Standard</SelectItem>
                                                        <SelectItem value="medium" className="uppercase text-[10px] font-bold">Operational</SelectItem>
                                                        <SelectItem value="high" className="uppercase text-[10px] font-bold">High Stakes</SelectItem>
                                                        <SelectItem value="critical" className="uppercase text-[10px] font-bold text-amber-500">Critical Priority</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3 md:col-span-2 bg-slate-950/30 p-4 rounded-2xl border border-slate-800/50">
                                            <Checkbox
                                                id="evidence"
                                                checked={requiresEvidence}
                                                onCheckedChange={(checked) => setRequiresEvidence(checked as boolean)}
                                                className="h-5 w-5 border-slate-700 data-[state=checked]:bg-amber-500 rounded-md"
                                            />
                                            <Label htmlFor="evidence" className="text-slate-400 flex items-center gap-3 cursor-pointer text-[10px] font-black uppercase tracking-widest">
                                                <Camera className="h-4 w-4 text-amber-500" />
                                                Visual Evidence Required for Verification
                                            </Label>
                                        </div>
                                        <div className="md:col-span-2 flex gap-4 pt-6 border-t border-slate-800 mt-4">
                                            <Button type="submit" disabled={creating} className="h-14 px-10 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest rounded-2xl border-none shadow-2xl shadow-amber-500/10 transition-all flex-1 md:flex-none">
                                                {creating ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Plus className="h-5 w-5 mr-3 font-black" />}
                                                Initialize Directive
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={resetForm} className="h-14 px-8 text-slate-500 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest rounded-2xl transition-all">
                                                Abort
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col gap-6">
                    <div className="flex items-end justify-between px-2">
                        <div className="flex flex-col">
                            <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic">Active Operations</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">{tasks.length} live directives monitored</p>
                        </div>
                        <Badge className="bg-slate-800 text-amber-500 border-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                            Network SLA: 24H
                        </Badge>
                    </div>

                    <div className="grid gap-4">
                        {tasks.map((task, idx) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="group relative"
                            >
                                <div
                                    className={`relative flex flex-col md:flex-row md:items-center justify-between p-8 bg-slate-900/40 rounded-[2rem] border border-slate-800/50 hover:border-amber-500/30 hover:bg-slate-900/60 transition-all duration-500 overflow-hidden ring-1 ring-white/5`}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Indicador de Status Visual */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${task.status === 'completed' || task.status === 'verified' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
                                        task.priority === 'critical' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-amber-500'
                                        }`} />

                                    <div className="flex items-start gap-8">
                                        <div className={`mt-1 p-4 rounded-[1.25rem] transition-all duration-500 ${task.status === 'completed' || task.status === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-950 shadow-inner text-slate-600 group-hover:text-amber-500'}`}>
                                            {task.validation_type === 'photo' ? <Camera className="h-6 w-6" /> : <ClipboardList className="h-6 w-6" />}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                                                {task.title}
                                                {new Date(task.due_date) < new Date() && task.status === 'pending' && (
                                                    <span className="flex h-3 w-3 rounded-full bg-red-500 animate-ping" />
                                                )}
                                            </h3>
                                            <p className="text-slate-400 text-sm font-medium line-clamp-1 max-w-xl group-hover:text-slate-300 transition-colors uppercase tracking-tight">{task.description || 'TECHNICAL DIRECTIVE NOT SPECIFIED.'}</p>

                                            <div className="flex items-center gap-6 mt-4">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                                    <Calendar className="h-3.5 w-3.5 text-slate-600" />
                                                    Horizon: {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                </div>
                                                <div className="h-4 w-[1px] bg-slate-800" />
                                                {getPriorityBadge(task.priority)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 md:mt-0 flex items-center justify-between md:justify-end gap-6 border-t md:border-none border-slate-800/50 pt-6 md:pt-0">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Directive Status</span>
                                            {getStatusBadge(task)}
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-12 w-12 rounded-2xl bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 border-none transition-all group-hover:translate-x-1">
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-32 bg-slate-900/20 rounded-[3rem] border border-slate-800/50 border-dashed">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                                    className="p-10 rounded-full bg-white/5 mb-8"
                                >
                                    <CheckCircle className="h-16 w-16 text-slate-700 opacity-20" />
                                </motion.div>
                                <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-xs">Operational Horizon Clear</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="mt-auto h-20 border-t border-slate-800/50 flex items-center px-12 text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
                Matrix View V.2.0 • Tactical Operations Console
            </footer>
        </div>
    )
}
