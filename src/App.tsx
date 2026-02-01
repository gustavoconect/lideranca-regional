
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import TasksPage from '@/pages/Tasks'
import ReportsPage from '@/pages/Reports'
import DataCenterPage from '@/pages/DataCenter'
import AdminUnitsPage from '@/pages/AdminUnits'
import UnitDashboardPage from '@/pages/UnitDashboard'
import AiConfigPage from '@/pages/AiConfig'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Toaster } from '@/components/ui/sonner'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />

                {/* Rotas Comuns */}
                <Route path="/tasks" element={
                    <ProtectedRoute>
                        <TasksPage />
                    </ProtectedRoute>
                } />

                {/* Rotas de Líder de Unidade */}
                <Route path="/unit-dashboard" element={
                    <ProtectedRoute allowedRoles={['unit_leader']}>
                        <UnitDashboardPage />
                    </ProtectedRoute>
                } />

                {/* Rotas de Regional (Admin) */}
                <Route path="/dashboard" element={
                    <ProtectedRoute allowedRoles={['regional_leader']}>
                        <DashboardPage />
                    </ProtectedRoute>
                } />
                <Route path="/reports" element={
                    <ProtectedRoute allowedRoles={['regional_leader']}>
                        <ReportsPage />
                    </ProtectedRoute>
                } />
                <Route path="/data-center" element={
                    <ProtectedRoute allowedRoles={['regional_leader']}>
                        <DataCenterPage />
                    </ProtectedRoute>
                } />
                <Route path="/units" element={
                    <ProtectedRoute allowedRoles={['regional_leader']}>
                        <AdminUnitsPage />
                    </ProtectedRoute>
                } />
                <Route path="/settings/ai" element={
                    <ProtectedRoute allowedRoles={['regional_leader']}>
                        <AiConfigPage />
                    </ProtectedRoute>
                } />

                {/* Redirecionamento Base */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <Toaster />
        </BrowserRouter>
    )
}

export default App
