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
  { path: '/suppliers/rankings', permission: 'reports.view', Component: lazy(() => import('@/modules/suppliers/pages/SupplierRankingsPage')) },
  { path: '/suppliers/price-contracts', permission: 'purchases.create', Component: lazy(() => import('@/modules/suppliers/pages/PriceContractsPage')) },
  { path: '/suppliers/:id', permission: 'suppliers.manage', Component: lazy(() => import('@/modules/suppliers/pages/SupplierDetailPage')) },

  { path: '/purchases', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchasesListPage')) },
  { path: '/purchases/new', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchaseFormPage')) },
  { path: '/purchases/:id', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchaseDetailPage')) },
  { path: '/purchases/:id/edit', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/PurchaseFormPage')) },

  { path: '/purchases/requests', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchase-requests/pages/PurchaseRequestsListPage')) },
  { path: '/purchases/requests/new', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchase-requests/pages/PurchaseRequestFormPage')) },
  { path: '/purchases/requests/:id', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchase-requests/pages/PurchaseRequestDetailPage')) },

  { path: '/purchases/orders', permission: 'purchase_orders.manage', Component: lazy(() => import('@/modules/purchases/pages/PurchaseOrdersListPage')) },
  { path: '/purchases/orders/new', permission: 'purchase_orders.manage', Component: lazy(() => import('@/modules/purchases/pages/PurchaseOrderFormPage')) },
  { path: '/purchases/orders/:id', permission: 'purchase_orders.manage', Component: lazy(() => import('@/modules/purchases/pages/PurchaseOrderDetailPage')) },
  { path: '/purchases/orders/:id/edit', permission: 'purchase_orders.manage', Component: lazy(() => import('@/modules/purchases/pages/PurchaseOrderFormPage')) },

  { path: '/purchases/receipts', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/GoodsReceiptsListPage')) },
  { path: '/purchases/receipts/new', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/GoodsReceiptFormPage')) },
  { path: '/purchases/receipts/:id', permission: 'purchases.create', Component: lazy(() => import('@/modules/purchases/pages/GoodsReceiptDetailPage')) },

  { path: '/sales', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesListPage')) },
  { path: '/sales/new', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesFormPage')) },
  { path: '/sales/:id', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesDetailPage')) },
  { path: '/sales/:id/edit', permission: 'sales.create', Component: lazy(() => import('@/modules/sales/pages/SalesFormPage')) },

  { path: '/payments', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentsListPage')) },
  { path: '/payments/new', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentFormPage')) },
  { path: '/payments/:id', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentDetailPage')) },
  { path: '/payments/:id/edit', permission: 'payments.create', Component: lazy(() => import('@/modules/payments/pages/PaymentFormPage')) },

  { path: '/employees', permission: 'employees.view', Component: lazy(() => import('@/modules/employees/pages/EmployeesListPage')) },
  { path: '/employees/scan', permission: 'employees.manage', Component: lazy(() => import('@/modules/employees/pages/LabourListScanPage')) },
  { path: '/employees/new', permission: 'employees.manage', Component: lazy(() => import('@/modules/employees/pages/EmployeeRecordPage')) },
  { path: '/employees/:id', permission: 'employees.manage', Component: lazy(() => import('@/modules/employees/pages/EmployeeRecordPage')) },

  { path: '/expenses', permission: 'expenses.manage', Component: lazy(() => import('@/modules/expenses/pages/ExpensesListPage')) },
  { path: '/expenses/new', permission: 'expenses.manage', Component: lazy(() => import('@/modules/expenses/pages/ExpenseFormPage')) },
  { path: '/expenses/:id', permission: 'expenses.manage', Component: lazy(() => import('@/modules/expenses/pages/ExpenseDetailPage')) },
  { path: '/expenses/:id/edit', permission: 'expenses.manage', Component: lazy(() => import('@/modules/expenses/pages/ExpenseFormPage')) },

  { path: '/payroll', permission: 'payroll.view', Component: lazy(() => import('@/modules/payroll/pages/PayrollListPage')) },
  { path: '/payroll/new', permission: 'payroll.manage', Component: lazy(() => import('@/modules/payroll/pages/SalaryEntryFormPage')) },
  { path: '/payroll/:id', permission: 'payroll.view', Component: lazy(() => import('@/modules/payroll/pages/SalaryEntryDetailPage')) },
  { path: '/payroll/:id/edit', permission: 'payroll.manage', Component: lazy(() => import('@/modules/payroll/pages/SalaryEntryFormPage')) },

  { path: '/inventory', permission: 'inventory.manage', Component: lazy(() => import('@/modules/inventory/pages/StockBalancesPage')) },
  { path: '/inventory/transfers', permission: 'inventory.manage', Component: lazy(() => import('@/modules/inventory/pages/BranchTransfersListPage')) },
  { path: '/inventory/transfers/new', permission: 'inventory.manage', Component: lazy(() => import('@/modules/inventory/pages/BranchTransferFormPage')) },
  { path: '/inventory/transfers/:id', permission: 'inventory.manage', Component: lazy(() => import('@/modules/inventory/pages/BranchTransferDetailPage')) },

  { path: '/settlements', permission: 'settlements.view', Component: lazy(() => import('@/modules/settlements/pages/SettlementsListPage')) },

  { path: '/settings/users', permission: 'users.manage', Component: lazy(() => import('@/modules/settings/pages/UsersAdminPage')) },
  { path: '/settings/restaurants', permission: 'restaurants.manage', Component: lazy(() => import('@/modules/settings/pages/RestaurantsAdminPage')) },
  { path: '/settings/appearance', Component: lazy(() => import('@/modules/settings/pages/AppearancePage')) },

  { path: '/accounting', permission: 'accounting.view', Component: lazy(() => import('@/modules/accounting/pages/AccountingPage')) },
  { path: '/reports', permission: 'reports.view', Component: lazy(() => import('@/modules/reports/pages/ReportsPage')) },
  { path: '/reports/audit-log', permission: 'audit.view', Component: lazy(() => import('@/modules/reports/pages/AuditLogPage')) },
  { path: '/reports/employees', permission: 'employees.view', Component: lazy(() => import('@/modules/reports/pages/EmployeesReportPage')) },
]

// Routes that don't have a built module yet — rendered as a permission-gated
// placeholder instead of fake functionality (spec §56). Remove an entry once
// its module is added to moduleRoutes above.
const comingSoonRoutes: { path: string; title: string; permission?: string }[] = []

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
