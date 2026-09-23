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

const SuppliersListPage = lazy(() => import('@/modules/suppliers/pages/SuppliersListPage'))

const PurchasesListPage = lazy(() => import('@/modules/purchases/pages/PurchasesListPage'))
const PurchaseFormPage = lazy(() => import('@/modules/purchases/pages/PurchaseFormPage'))
const PurchaseDetailPage = lazy(() => import('@/modules/purchases/pages/PurchaseDetailPage'))

// Routes that don't have a built module yet — rendered as a permission-gated
// placeholder instead of fake functionality (spec §56).
const comingSoonRoutes: { path: string; title: string; permission?: string }[] = [
  { path: '/purchases/requests', title: 'Purchase Requests', permission: 'purchases.create' },
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

            <Route
              path="/suppliers"
              element={
                <RequirePermission permission="suppliers.manage">
                  <SuppliersListPage />
                </RequirePermission>
              }
            />

            <Route
              path="/purchases"
              element={
                <RequirePermission permission="purchases.create">
                  <PurchasesListPage />
                </RequirePermission>
              }
            />
            <Route
              path="/purchases/new"
              element={
                <RequirePermission permission="purchases.create">
                  <PurchaseFormPage />
                </RequirePermission>
              }
            />
            <Route
              path="/purchases/:id"
              element={
                <RequirePermission permission="purchases.create">
                  <PurchaseDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="/purchases/:id/edit"
              element={
                <RequirePermission permission="purchases.create">
                  <PurchaseFormPage />
                </RequirePermission>
              }
            />

            {comingSoonRoutes.map(({ path, title, permission }) => (
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
