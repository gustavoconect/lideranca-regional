'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export function SignUpForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<'regional_leader' | 'unit_leader'>('unit_leader')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            // 1. Sign up user in Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role
                    }
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('Falha ao criar usuário')

            // 2. Profile is usually created by a database trigger in Supabase (handle_new_user)
            // But if it's not set up, we should ensure the profile has the correct role.
            // In our schema.sql, we have the profiles table.

            toast.success('Cadastro realizado! Verifique seu e-mail ou entre agora.')

            // Redirect to appropriate dashboard based on role
            if (role === 'regional_leader') {
                navigate('/dashboard')
            } else {
                navigate('/unit-dashboard')
            }

        } catch (err: any) {
            setError(err.message)
            toast.error('Erro no cadastro: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="fullName" className="text-slate-300">Nome Completo</Label>
                <Input
                    id="fullName"
                    placeholder="Ex: João Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-slate-900 border-slate-800 text-white"
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="email" className="text-slate-300">E-mail Corporativo</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="m@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-slate-900 border-slate-800 text-white"
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-slate-900 border-slate-800 text-white"
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="role" className="text-slate-300">Sua Função</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                        <SelectValue placeholder="Selecione sua função" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="unit_leader">Líder de Unidade</SelectItem>
                        <SelectItem value="regional_leader">Líder Regional</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                    <span className="flex items-center gap-2">
                        Criar Conta Executiva <ArrowRight className="h-4 w-4" />
                    </span>
                )}
            </Button>
        </form>
    )
}
