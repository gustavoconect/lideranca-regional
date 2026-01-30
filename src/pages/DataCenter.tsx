import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft, Upload, FileText, Database, ShieldCheck, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface UploadedFile {
    id: string
    name: string
    size: string
    status: 'pending' | 'processing' | 'completed' | 'error'
    progress: number
}

export default function DataCenter() {
    const navigate = useNavigate()
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [isConsolidating, setIsConsolidating] = useState(false)

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf')
        handleFiles(droppedFiles)
    }, [])

    const handleFiles = (newFiles: File[]) => {
        const mappedFiles: UploadedFile[] = newFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            status: 'pending',
            progress: 0
        }))
        setFiles(prev => [...prev, ...mappedFiles])
        toast.success(`${newFiles.length} arquivos adicionados à fila de processamento.`)
    }

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }

    const consolidateData = () => {
        if (files.length === 0) {
            toast.error('Adicione arquivos antes de consolidar a base de dados.')
            return
        }
        setIsConsolidating(true)
        // Simulate processing
        setTimeout(() => {
            setIsConsolidating(false)
            toast.success('Base de dados consolidada com sucesso! A IA agora possui mais contexto para gerar relatórios.')
            navigate('/reports')
        }, 3000)
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#0F172A] text-slate-200">
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between px-6 md:px-12 glass-dark border-b border-slate-800/50 backdrop-blur-2xl">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/reports')} className="rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">Strategic Data Center</h1>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em]">Knowledge Base Expansion Engine</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                        DB SECURE: AES-256
                    </Badge>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-12">
                <div className="grid gap-8 lg:grid-cols-12">
                    {/* Upload Zone */}
                    <div className="lg:col-span-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            className={`relative flex flex-col items-center justify-center py-24 rounded-[3rem] border-2 border-dashed transition-all duration-500 ${isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/40'}`}
                        >
                            <input
                                type="file"
                                multiple
                                accept=".pdf"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                            />
                            <div className="p-8 rounded-[2.5rem] bg-slate-950 shadow-2xl mb-8 relative">
                                <Upload className={`h-12 w-12 text-emerald-500 transition-all duration-500 ${isDragging ? 'scale-125' : ''}`} />
                                <div className="absolute -top-2 -right-2 p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
                                    <Database className="h-4 w-4 text-slate-950" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">Feed the Intelligence Engine</h2>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest text-center max-w-md px-6 leading-relaxed">
                                Arraste seus arquivos PDF de feedback regional aqui para que a IA processe e gere insights mais robustos.
                            </p>
                        </motion.div>
                    </div>

                    {/* Pending Actions */}
                    <div className="lg:col-span-8">
                        <div className="flex flex-col gap-6 h-full">
                            <div className="flex items-end justify-between px-2">
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Processing Queue</h2>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">{files.length} documents identified</p>
                                </div>
                            </div>

                            <Card className="flex-1 bg-slate-900 border-none ring-1 ring-slate-800 rounded-[2.5rem] overflow-hidden">
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        {files.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full py-20 opacity-20 italic">
                                                <FileText className="h-12 w-12 mb-4" />
                                                <p className="text-xs uppercase font-black tracking-widest">Aguardando entrada de dados...</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-800">
                                                <AnimatePresence>
                                                    {files.map((file) => (
                                                        <motion.div
                                                            key={file.id}
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: 20 }}
                                                            className="flex items-center justify-between p-6 hover:bg-slate-800/30 transition-all group"
                                                        >
                                                            <div className="flex items-center gap-6">
                                                                <div className="p-4 rounded-2xl bg-slate-950 text-emerald-500 shadow-inner group-hover:text-emerald-400 transition-colors">
                                                                    <FileText className="h-6 w-6" />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <p className="text-sm font-black text-white uppercase tracking-tight">{file.name}</p>
                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{file.size}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Badge className="bg-slate-950 text-slate-500 border-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                                    {file.status}
                                                                </Badge>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => removeFile(file.id)}
                                                                    className="h-10 w-10 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Stats & Consolidate */}
                    <div className="lg:col-span-4 space-y-8">
                        <Card className="bg-slate-900 border-none ring-1 ring-slate-800 rounded-[2.5rem] overflow-hidden">
                            <CardHeader>
                                <CardTitle className="text-sm font-black tracking-widest uppercase italic text-emerald-500">Operation Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        <span>Capacity Utilization</span>
                                        <span>{(files.length * 10).toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden p-0.5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, files.length * 10)}%` }}
                                            className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-950 p-4 rounded-2xl">
                                        <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Total Files</p>
                                        <p className="text-xl font-black text-white italic">{files.length}</p>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded-2xl">
                                        <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Status</p>
                                        <p className="text-xl font-black text-emerald-500 italic">Ready</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Button
                            disabled={files.length === 0 || isConsolidating}
                            onClick={consolidateData}
                            className={`w-full h-24 rounded-[2rem] flex flex-col items-center justify-center gap-1 transition-all duration-500 shadow-2xl ${isConsolidating ? 'bg-slate-800' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-95'}`}
                        >
                            {isConsolidating ? (
                                <>
                                    <RefreshCw className="h-6 w-6 animate-spin mb-1" />
                                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">Processing Data...</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="h-6 w-6 mb-1" />
                                    <span className="font-black uppercase tracking-[0.2em] text-[12px]">Consolidate Knowledge</span>
                                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-60 italic">Process all listed signals</span>
                                </>
                            )}
                        </Button>

                        <div className="p-8 bg-slate-950/30 rounded-[2.5rem] border border-slate-800/50 flex items-start gap-4">
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-1" />
                            <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed tracking-widest italic">
                                A consolidação funde as novas informações com a base histórica, garantindo que os futuros relatórios gerados pela IA sejam mais precisos e baseados em maior volumetria de dados.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
