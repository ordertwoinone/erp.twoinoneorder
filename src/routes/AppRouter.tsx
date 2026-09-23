import { lazy, Suspense, type ComponentType } from 'react'
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

interface ModuleRoute {
  path: string
  permission?: string
  Component: ComponentType
}

// One entry per built page. `path` is relative to the app shell (leading /).
// Add entries here as each module ships; nothing else in this file needs to
// change for a new module's routes.
const moduleRoutes: ModuleRoute[] = [
  { path: '/suppliers', permission: 'suppliers.manage', Component: lazy(() => import('@/modules/suppliers/pages/SuppliersListPage')) },

  { path: '/purchases', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchasesListPage')) },
  { path: '/purchases/new', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchaseFormPage')) },
  { path: '/purchases/:id', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchaseDetailPage')) },
  { path: '/purchases/:id/edit', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchaseFormPage')) },

  { path: '/sales', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesListPage')) },
  { path: '/sales/new', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesFormPage')) },
  { path: '/sales/:id', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesDetailPage')) },
  { path: '/sales/:id/edit', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesFormPage')) },

  { path: '/payments', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentsListPage')) },
  { path: '/payments/new', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentFormPage')) },
  { path: '/payments/:id', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentDetailPage')) },
  { path: '/payments/:id/edit', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentFormPage')) },
]

// Routes that don't have a built module yet — rendered as a permission-gated
// placeholder instead of fake functionality (spec §56). Remove an entry once
// its module is added to moduleRoutes above.
const comingSoonRoutes: { path: string; title: string; permission?: string }[] = [
  { path: '/purchases/requests', title: 'Purchase Requests', permission: 'purchases.create' },
  { path: '/settlements', title: 'Settlements', permission: 'settlements.view' },
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

            {moduleRoutes.map(({ path, permission, Component }) => (
              <Route
                key={path}
                path={path}
                element={
                  permission ? (
                    <RequirePermission permission={permission}>
                      <Component />
                    </RequirePermission>
                  ) : (
                    <Component />
                  )
                }
              />
            ))}

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
