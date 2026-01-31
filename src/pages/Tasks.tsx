import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
    ArrowLeft,
    Plus,
    Calendar,
    Clock,
    Target,
    AlertCircle,
    CheckCircle,
    X,
    Upload,
    ShieldAlert,
    Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Task {
    id: string
    title: string
    description: string
    status: 'pending' | 'completed' | 'verified' | 'overdue'
    priority: 'low' | 'medium' | 'high' | 'critical'
    due_date: string
    validation_type: 'checkbox' | 'photo'
    proof_url?: string
    completed_at?: string
    unit_leader_id: string
}

interface Unit {
    id: string
    name: string
    leader_id: string
}

export default function TasksPage() {
    const navigate = useNavigate()
    const [tasks, setTasks] = useState<Task[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [loading, setLoading] = useState(true)
    const [userRole, setUserRole] = useState<'regional_leader' | 'unit_leader' | null>(null)
    const [userId, setUserId] = useState<string | null>(null)

    // Audit/Verification state
    const [viewingProof, setViewingProof] = useState<Task | null>(null)
    const [verifying, setVerifying] = useState(false)

    // Completion modal state
    const [completingTask, setCompletingTask] = useState<Task | null>(null)
    const [uploading, setUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [filePreview, setFilePreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state (Admin only)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
    const [dueDate, setDueDate] = useState('')
    const [targetUnit, setTargetUnit] = useState<string>('all')
    const [requiresEvidence, setRequiresEvidence] = useState(false)

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                navigate('/login')
                return
            }
            setUserId(user.id)

            // Get user profile/role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            setUserRole(profile?.role || 'unit_leader')
            fetchTasks()

            if (profile?.role === 'regional_leader') {
                fetchUnits()
            }
        }
        init()
    }, [])

    const fetchTasks = async () => {
        setLoading(true)
        try {
            // RLS handles the filtering automatically based on the user's role/id
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .order('due_date', { ascending: true })

            if (error) throw error
            setTasks(data || [])
        } catch (error: any) {
            toast.error('Erro ao carregar tarefas: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const fetchUnits = async () => {
        const { data } = await supabase.from('units').select('id, name, leader_id')
        setUnits(data || [])
    }

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!userId) return

        try {
            const newTask = {
                title,
                description,
                priority,
                due_date: new Date(dueDate).toISOString(),
                validation_type: requiresEvidence ? 'photo' : 'checkbox',
                regional_leader_id: userId,
                // If 'all', we might need to insert multiple records or handle it in a trigger.
                // For now, let's assume we assign to a specific leader or self.
                unit_leader_id: targetUnit === 'all' ? userId : (units.find(u => u.id === targetUnit)?.leader_id || userId),
                status: 'pending'
            }

            const { error } = await supabase.from('tasks').insert(newTask)
            if (error) throw error

            toast.success('Diretriz operacional disparada para a rede!')
            setIsCreateModalOpen(false)
            resetForm()
            fetchTasks()
        } catch (error: any) {
            toast.error('Erro ao criar tarefa: ' + error.message)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Arquivo muito grande! Máximo 5MB.')
                return
            }
            setSelectedFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setFilePreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleCompleteTask = async () => {
        if (!completingTask || !userId) return
        setUploading(true)

        try {
            let proofUrl = ''
            if (completingTask.validation_type === 'photo' && selectedFile) {
                const fileExt = selectedFile.name.split('.').pop()
                const fileName = `${completingTask.id}-${Date.now()}.${fileExt}`
                const filePath = `task-proofs/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('task-proofs')
                    .upload(filePath, selectedFile)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('task-proofs')
                    .getPublicUrl(filePath)

                proofUrl = publicUrl
            }

            const { error } = await supabase
                .from('tasks')
                .update({
                    status: 'completed',
                    proof_url: proofUrl,
                    completed_at: new Date().toISOString()
                })
                .eq('id', completingTask.id)

            if (error) throw error

            toast.success('Missão cumprida! Evidência enviada com sucesso.')
            setCompletingTask(null)
            setSelectedFile(null)
            setFilePreview(null)
            fetchTasks()
        } catch (error: any) {
            toast.error('Erro ao finalizar: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleVerifyTask = async (taskId: string) => {
        if (!userId) return
        setVerifying(true)
        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    status: 'verified',
                })
                .eq('id', taskId)

            if (error) throw error
            toast.success('Diretriz validada com sucesso!')
            setViewingProof(null)
            fetchTasks()
        } catch (error: any) {
            toast.error('Erro ao validar: ' + error.message)
        } finally {
            setVerifying(false)
        }
    }

    const resetForm = () => {
        setTitle('')
        setDescription('')
        setPriority('medium')
        setDueDate('')
        setTargetUnit('all')
        setRequiresEvidence(false)
    }

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'critical': return 'bg-red-500 text-white shadow-lg shadow-red-500/20'
            case 'high': return 'bg-amber-500 text-white'
            case 'medium': return 'bg-indigo-500 text-white'
            default: return 'bg-slate-500 text-white'
        }
    }

    const getStatusBadge = (t: Task) => {
        if (t.status === 'verified') return <Badge className="bg-emerald-500 text-slate-950 font-black px-3 rounded-full uppercase text-[9px]">Verified</Badge>
        if (t.status === 'completed') return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-3 rounded-full uppercase text-[9px]">Awaiting Audit</Badge>
        if (new Date(t.due_date) < new Date() && t.status === 'pending') return <Badge className="bg-red-500 text-white px-3 rounded-full uppercase text-[9px]">Overdue</Badge>
        return <Badge className="bg-slate-800 text-slate-400 px-3 rounded-full uppercase text-[9px]">In Progress</Badge>
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-950 text-slate-200">
            {/* Header com Matrix UI */}
            <header className="sticky top-0 z-40 flex h-20 items-center gap-4 border-b border-slate-800/60 bg-slate-950/80 px-6 backdrop-blur-xl md:px-12 shadow-2xl">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-2xl hover:bg-slate-800 transition-all border border-slate-800">
                    <ArrowLeft className="h-5 w-5 text-slate-400" />
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tighter text-white uppercase italic flex items-center gap-2">
                        Operational Directives
                        <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">Tactical Oversight Console</p>
                </div>

                {userRole === 'regional_leader' && (
                    <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="ml-auto gap-3 h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-600/20 transition-all border-none"
                    >
                        <Plus className="h-4 w-4" /> Nova Diretriz
                    </Button>
                )}
            </header>

            <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em]">Mission Control</span>
                        <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">Atividades Pendentes</h2>
                    </div>
                    <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/50">
                        <Button variant="ghost" className="rounded-xl px-6 text-[10px] font-black uppercase tracking-widest bg-slate-800 text-white shadow-lg shadow-black/20">All Active</Button>
                        <Button variant="ghost" className="rounded-xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Critical Only</Button>
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-48 rounded-[2.5rem] bg-slate-900/50 animate-pulse border border-slate-800/50" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
                        <AnimatePresence>
                            {tasks.map((task, index) => (
                                <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <div
                                        onClick={() => userRole === 'unit_leader' && task.status === 'pending' && setCompletingTask(task)}
                                        className={`group relative bg-slate-900/40 border border-slate-800/50 rounded-[2.5rem] p-8 transition-all hover:bg-slate-900/60 hover:border-slate-700 hover:shadow-2xl overflow-hidden ${userRole === 'unit_leader' && task.status === 'pending' ? 'cursor-pointer' : ''}`}
                                    >
                                        <div className={`absolute top-0 left-0 w-1.5 h-full ${getPriorityColor(task.priority)} opacity-80`} />

                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <Badge className={`${getPriorityColor(task.priority)} border-none text-[9px] font-black uppercase px-3 py-1 rounded-full`}>
                                                        {task.priority}
                                                    </Badge>
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                            {new Date(task.due_date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight group-hover:text-emerald-400 transition-colors mb-2 italic">
                                                        {task.title}
                                                    </h3>
                                                    <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-2xl">
                                                        {task.description}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                            Time remaining: {Math.max(0, Math.ceil((new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} days
                                                        </span>
                                                    </div>
                                                    {task.validation_type === 'photo' && (
                                                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 rounded-xl border border-amber-500/20">
                                                            <Target className="h-3.5 w-3.5 text-amber-500" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Evidence Required</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-8 md:mt-0 flex items-center justify-between md:justify-end gap-6 border-t md:border-none border-slate-800/50 pt-6 md:pt-0">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Directive Status</span>
                                                    {getStatusBadge(task)}
                                                </div>

                                                {/* Unit Leader: Quick Finish Button */}
                                                {userRole === 'unit_leader' && task.status === 'pending' && (
                                                    <Button size="icon" variant="ghost" className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 hover:text-white hover:bg-amber-500 border-none transition-all group-hover:translate-x-1">
                                                        <CheckCircle className="h-5 w-5" />
                                                    </Button>
                                                )}

                                                {/* Regional: Audit/Proof View Button */}
                                                {userRole === 'regional_leader' && task.status === 'completed' && (
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setViewingProof(task)
                                                        }}
                                                        className="h-12 px-6 rounded-2xl bg-emerald-500 text-slate-950 font-black uppercase text-[10px] tracking-widest hover:bg-emerald-400 border-none transition-all shadow-lg shadow-emerald-500/10"
                                                    >
                                                        Auditar Prova
                                                    </Button>
                                                )}

                                                {userRole === 'regional_leader' && task.status === 'verified' && (
                                                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                        <ShieldAlert className="h-6 w-6" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            {/* Modal de Criação (Regional Only) */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 rounded-[2.5rem] sm:max-w-[500px] overflow-hidden p-0 ring-1 ring-white/10 shadow-2xl">
                    <div className="h-2 bg-indigo-600 w-full" />
                    <form onSubmit={handleCreateTask} className="p-8">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400">
                                    <Plus className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">Nova Diretriz</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-left">Set tactical priorities for the units</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Objective Title</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Auditoria de Fachada e Limpeza"
                                    className="h-14 bg-slate-950 border-slate-800 rounded-2xl focus:ring-indigo-500/50 focus:border-indigo-500 text-sm font-bold placeholder:text-slate-700"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Priority</Label>
                                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                                        <SelectTrigger className="h-14 bg-slate-950 border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800">
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Deadline</Label>
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="h-14 bg-slate-950 border-slate-800 rounded-2xl text-xs font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Target Unit</Label>
                                <Select value={targetUnit} onValueChange={setTargetUnit}>
                                    <SelectTrigger className="h-14 bg-slate-950 border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800">
                                        <SelectItem value="all">Todas as Unidades</SelectItem>
                                        {units.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                                <Checkbox
                                    id="evidence"
                                    checked={requiresEvidence}
                                    onCheckedChange={(checked) => setRequiresEvidence(!!checked)}
                                    className="h-5 w-5 rounded-lg border-slate-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                />
                                <Label htmlFor="evidence" className="text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer">Requer Evidência Fotográfica</Label>
                            </div>
                        </div>

                        <DialogFooter className="mt-10 flex gap-3">
                            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)} className="h-14 flex-1 text-slate-500 hover:text-white font-black uppercase tracking-widest text-xs rounded-2xl">Cancelar</Button>
                            <Button type="submit" className="h-14 flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-600/20 transition-all border-none">Disparar Diretriz</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de Conclusão (Unit Leader Only) */}
            <Dialog open={!!completingTask} onOpenChange={(open) => !open && setCompletingTask(null)}>
                <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 rounded-[2.5rem] sm:max-w-[450px] overflow-hidden p-0 ring-1 ring-white/10 shadow-2xl">
                    <div className="h-2 bg-emerald-500 w-full" />
                    <div className="p-8 text-center sm:text-left">
                        <DialogHeader className="mb-6">
                            <div className="flex items-center justify-center sm:justify-start gap-4 mb-4">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                                    <CheckCircle className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">Finalizar Missão</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Confirme a execução da diretriz</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 text-left">
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-1">Objetivo Selecionado</span>
                                <p className="text-sm font-bold text-white border-none leading-relaxed">{completingTask?.title}</p>
                            </div>

                            {completingTask?.validation_type === 'photo' && (
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center justify-between">
                                        Evidência Visual Obrigatória
                                    </Label>

                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center gap-3 ${filePreview ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/20'}`}
                                    >
                                        {filePreview ? (
                                            <div className="relative w-full aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-lg">
                                                <img src={filePreview} alt="Evidence" className="w-full h-full object-cover" />
                                                <Button
                                                    size="icon"
                                                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-slate-950/80 text-white hover:bg-red-500"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setFilePreview(null)
                                                        setSelectedFile(null)
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-4 rounded-full bg-slate-800 text-slate-500 group-hover:text-amber-500 group-hover:scale-110 transition-all">
                                                    <Upload className="h-6 w-6" />
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Upload Photo</span>
                                                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">JPG, PNG (MAX 5MB)</span>
                                                </div>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            className="hidden"
                                            ref={fileInputRef}
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                <AlertCircle className="h-4 w-4 text-emerald-500" />
                                <p className="text-[9px] font-black uppercase tracking-widest text-left text-emerald-500 leading-relaxed">O Regional será notificado desta conclusão após o envio para auditoria tática.</p>
                            </div>
                        </div>

                        <DialogFooter className="mt-10 flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setCompletingTask(null)}
                                className="h-14 flex-1 text-slate-500 hover:text-white font-black uppercase tracking-widest text-xs rounded-2xl border-none"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCompleteTask}
                                disabled={uploading || (completingTask?.validation_type === 'photo' && !selectedFile)}
                                className="h-14 flex-[2] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-500/10 transition-all border-none"
                            >
                                {uploading ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <CheckCircle className="h-5 w-5 mr-3" />}
                                Finalizar Missão
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Auditoria do Regional */}
            <Dialog open={!!viewingProof} onOpenChange={(open) => !open && setViewingProof(null)}>
                <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 rounded-[2.5rem] sm:max-w-[600px] overflow-hidden p-0 ring-1 ring-white/10 shadow-2xl">
                    <div className="h-2 bg-emerald-500 w-full" />
                    <div className="p-8">
                        <DialogHeader className="mb-6 text-left">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                                    <ShieldAlert className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">Auditoria de Diretriz</DialogTitle>
                                    <DialogDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Validar evidência operacional enviada</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-1">Objetivo</span>
                                    <p className="text-xs font-bold text-white border-none leading-relaxed line-clamp-2">{viewingProof?.title}</p>
                                </div>
                                <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-1">Concluído em</span>
                                    <p className="text-xs font-bold text-white border-none">{viewingProof?.completed_at ? new Date(viewingProof.completed_at).toLocaleString() : '---'}</p>
                                </div>
                            </div>

                            {viewingProof?.proof_url ? (
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Evidência Fotográfica</Label>
                                    <div className="relative rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl aspect-video bg-slate-950">
                                        <img src={viewingProof.proof_url} alt="Proof" className="w-full h-full object-contain" />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center gap-3">
                                    <AlertCircle className="h-8 w-8 text-slate-700" />
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Nenhuma foto anexada</span>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="mt-10 flex gap-3 text-left">
                            <Button
                                variant="ghost"
                                onClick={() => setViewingProof(null)}
                                className="h-14 flex-1 text-slate-500 hover:text-white font-black uppercase tracking-widest text-xs rounded-2xl border-none"
                            >
                                Fechar
                            </Button>
                            <Button
                                onClick={() => viewingProof && handleVerifyTask(viewingProof.id)}
                                disabled={verifying}
                                className="h-14 flex-[2] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-500/10 transition-all border-none"
                            >
                                {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <CheckCircle className="h-5 w-5 mr-3" />}
                                Validar Diretriz
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <footer className="mt-auto h-20 border-t border-slate-800/50 flex items-center px-12 text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
                Matrix View V.2.0 • Tactical Operations Console
            </footer>
        </div>
    )
}
