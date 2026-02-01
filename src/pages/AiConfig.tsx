import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, Sparkles, Loader2, Info, MessageSquareCode } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface AiPrompt {
    id: string
    slug: string
    name: string
    description: string
    prompt_text: string
}

export default function AiConfigPage() {
    const navigate = useNavigate()
    const [prompts, setPrompts] = useState<AiPrompt[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null)

    useEffect(() => {
        checkAuth()
        fetchPrompts()
    }, [])

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            navigate('/login')
            return
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'regional_leader') {
            toast.error('Acesso restrito a Líderes Regionais.')
            navigate('/dashboard')
        }
    }

    const fetchPrompts = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_prompts')
                .select('*')
                .order('name')

            if (error) throw error
            setPrompts(data || [])
        } catch (error: any) {
            toast.error('Erro ao buscar prompts: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (prompt: AiPrompt) => {
        setSavingId(prompt.id)
        try {
            const { error } = await supabase
                .from('ai_prompts')
                .update({
                    prompt_text: prompt.prompt_text,
                    updated_at: new Date().toISOString()
                })
                .eq('id', prompt.id)

            if (error) throw error

            toast.success(`Prompt "${prompt.name}" atualizado com sucesso!`)
            setEditingPrompt(null)
            fetchPrompts()
        } catch (error: any) {
            toast.error('Erro ao salvar prompt: ' + error.message)
        } finally {
            setSavingId(null)
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC]">
            <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b bg-white/80 px-4 backdrop-blur-xl md:px-10 shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-xl hover:bg-slate-100">
                    <ArrowLeft className="h-5 w-5 text-slate-600" />
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase italic">Configuração de IA</h1>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Gerenciamento de Prompts Estratégicos</p>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full space-y-8">
                <section className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">Prompts Disponíveis</h2>
                    </div>

                    <div className="grid gap-6">
                        {prompts.map((prompt) => (
                            <motion.div
                                key={prompt.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white ring-1 ring-slate-100 hover:ring-primary/30 transition-all">
                                    <div className="h-2 bg-slate-900 w-full" />
                                    <CardHeader className="p-8 pb-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 italic">
                                                    {prompt.name}
                                                </CardTitle>
                                                <CardDescription className="text-xs font-bold text-slate-400 uppercase mt-1">
                                                    SLUG: <span className="text-primary">{prompt.slug}</span>
                                                </CardDescription>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 border-slate-200"
                                                onClick={() => setEditingPrompt(editingPrompt?.id === prompt.id ? null : prompt)}
                                            >
                                                {editingPrompt?.id === prompt.id ? 'Fechar Editor' : 'Editar Prompt'}
                                            </Button>
                                        </div>
                                        <p className="mt-4 text-sm text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            {prompt.description}
                                        </p>
                                    </CardHeader>

                                    <AnimatePresence>
                                        {editingPrompt?.id === prompt.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <CardContent className="px-8 pb-8 pt-2 space-y-6">
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                                            <MessageSquareCode className="h-3 w-3" /> Template do Prompt
                                                        </Label>
                                                        <Textarea
                                                            value={editingPrompt.prompt_text}
                                                            onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt_text: e.target.value })}
                                                            className="min-h-[400px] font-mono text-sm leading-relaxed bg-slate-900 text-slate-100 rounded-2xl border-none shadow-inner p-6 focus-visible:ring-1 focus-visible:ring-primary/50"
                                                            placeholder="Cole aqui o novo prompt..."
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                                                                <Info className="h-4 w-4" />
                                                            </div>
                                                            <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                                                                Use <code className="text-primary font-black lowercase">{"{{tags}}"}</code> para variáveis dinâmicas do sistema.
                                                            </p>
                                                        </div>
                                                        <Button
                                                            onClick={() => handleSave(editingPrompt)}
                                                            disabled={savingId === prompt.id}
                                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl shadow-lg shadow-indigo-200"
                                                        >
                                                            {savingId === prompt.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <Save className="h-4 w-4" /> Atualizar Template
                                                                </div>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    )
}
