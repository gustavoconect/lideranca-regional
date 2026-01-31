import { LoginForm } from "@/components/forms/login-form"
import { SignUpForm } from "@/components/forms/signup-form"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0F172A] overflow-hidden p-4">
            {/* Background Mesh/Gradient Decorativo */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-sm z-10"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-black shadow-xl shadow-primary/20 mb-4">
                        <BarChart3 className="h-7 w-7" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase italic text-center">
                        SmartFit <span className="text-primary border-none">SP15</span>
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1 text-center">
                        Liderança de Alta Performance
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="border-none bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl overflow-hidden">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-xl font-bold text-white">
                                    {mode === 'login' ? 'Acesso Restrito' : 'Novo Cadastro'}
                                </CardTitle>
                                <CardDescription className="text-slate-400 text-sm">
                                    {mode === 'login' ? 'Entre com suas credenciais executivas.' : 'Crie sua identidade de liderança SP15.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {mode === 'login' ? <LoginForm /> : <SignUpForm />}
                                <div className="mt-6 text-center">
                                    <button
                                        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                        className="text-[10px] uppercase tracking-widest font-black text-primary hover:text-primary/80 transition-colors"
                                    >
                                        {mode === 'login' ? 'Não tem conta? Cadastre-se →' : 'Já possui conta? Clique aqui'}
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </AnimatePresence>

                <p className="mt-8 text-center text-[9px] text-slate-500 uppercase tracking-widest font-medium">
                    © 2026 SmartFit SP15 Intelligence System • V.2.1 Elite
                </p>
            </motion.div>
        </div>
    )
}
