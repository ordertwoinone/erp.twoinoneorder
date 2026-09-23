import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ComingSoon } from '@/components/shared/ComingSoon'
import { ProtectedRoute, RequirePermission } from './ProtectedRoute'

const LoginPage = lazy(() => import('@/modules/auth/pages/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/modules/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/modules/auth/pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/modules/dashboard/pages/DashboardPage'))
const NotFoundPage = lazy(() => import('@/modules/dashboard/pages/NotFoundPage'))

const moduleRoutes: { path: string; title: string; permission?: string }[] = [
  { path: '/purchases', title: 'Purchases', permission: 'purchases.create' },
  { path: '/purchases/requests', title: 'Purchase Requests', permission: 'purchases.create' },
  { path: '/suppliers', title: 'Suppliers', permission: 'suppliers.manage' },
  { path: '/sales', title: 'Sales Entry', permission: 'sales.create' },
  { path: '/settlements', title: 'Settlements', permission: 'settlements.view' },
  { path: '/payments', title: 'Payments', permission: 'payments.create' },
  { path: '/expenses', title: 'Expenses', permission: 'expenses.manage' },
  { path: '/accounting', title: 'Accounting', permission: 'accounting.view' },
  { path: '/employees', title: 'Employees', permission: 'employees.view' },
  { path: '/payroll', title: 'Payroll', permission: 'payroll.view' },
  { path: '/inventory', title: 'Inventory', permission: 'inventory.manage' },
  { path: '/reports', title: 'Reports', permission: 'reports.view' },
  { path: '/settings/users', title: 'Users', permission: 'users.manage' },
  { path: '/settings/restaurants', title: 'Restaurants', permission: 'restaurants.manage' },
]

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenSpinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            {moduleRoutes.map(({ path, title, permission }) => (
              <Route
                key={path}
                path={path}
                element={
                  permission ? (
                    <RequirePermission permission={permission}>
                      <ComingSoon title={title} />
                    </RequirePermission>
                  ) : (
                    <ComingSoon title={title} />
                  )
                }
              />
            ))}
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
