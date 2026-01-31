
import { ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
    children: ReactNode
    allowedRoles?: ('regional_leader' | 'unit_leader')[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const [loading, setLoading] = useState(true)
    const [authenticated, setAuthenticated] = useState(false)
    const [userRole, setUserRole] = useState<string | null>(null)
    const location = useLocation()

    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setAuthenticated(false)
                setLoading(false)
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            setAuthenticated(true)
            setUserRole(profile?.role || 'unit_leader')
        } catch (error) {
            console.error('Auth check error:', error)
            setAuthenticated(false)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#0F172A]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (!authenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (allowedRoles && userRole && !allowedRoles.includes(userRole as any)) {
        return <Navigate to="/dashboard" replace />
    }

    return <>{children}</>
}
