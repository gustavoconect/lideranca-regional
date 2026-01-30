import { LoginForm } from "@/components/forms/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import { motion } from "framer-motion"

export default function LoginPage() {
    return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0F172A] overflow-hidden p-4">
            {/* Background Mesh/Gradient Decorativo */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-sm z-10"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-4">
                        <BarChart3 className="h-7 w-7" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
                        Regional<span className="text-emerald-400">App</span>
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                        High-Performance Leadership
                    </p>
                </div>

                <Card className="border-none bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-xl font-bold text-white">Acesso Restrito</CardTitle>
                        <CardDescription className="text-slate-400 text-sm">
                            Entre com suas credenciais executivas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LoginForm />
                    </CardContent>
                </Card>

                <p className="mt-8 text-center text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                    © 2026 Regional Leader System • V.2.0 Elite
                </p>
            </motion.div>
        </div>
    )
}
