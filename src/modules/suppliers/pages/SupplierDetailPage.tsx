import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useCategoriesOptions } from '@/hooks/useCatalogOptions'
import { useSupplierQuery } from '../hooks/useSuppliers'
import { usePriceLocksQuery } from '../hooks/usePriceLocks'
import { useSupplierScanJobsQuery } from '../hooks/useQuotationScan'
import { SupplierFormDialog } from '../components/SupplierFormDialog'
import { PriceLockFormDialog } from '../components/PriceLockFormDialog'
import { QuotationScanDialog } from '../components/QuotationScanDialog'

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canManagePrices = hasPermission('supplier_prices.manage')
  const [editOpen, setEditOpen] = useState(false)

  const { data: supplier, isLoading } = useSupplierQuery(id)
  const { data: priceLocks, isLoading: locksLoading } = usePriceLocksQuery(id)
  const { data: scanJobs } = useSupplierScanJobsQuery(id)
  const { data: categories } = useCategoriesOptions()

  if (isLoading || !supplier) return <FullScreenSpinner />

  const supplierCategoryNames = (supplier.category_ids ?? [])
    .map((cid) => categories?.find((c) => c.id === cid)?.name)
    .filter((name): name is string => !!name)

  const currentLocks = priceLocks?.filter((l) => l.is_current) ?? []
  const historicalLocks = priceLocks?.filter((l) => !l.is_current) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        description={`${supplier.code} · ${supplier.payment_terms_days} day terms${supplier.salesman_name ? ` · Salesman: ${supplier.salesman_name}` : ''}`}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
        }
      />

      {(supplier.supplier_type || supplierCategoryNames.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {supplier.supplier_type && (
            <Badge variant="secondary" className="capitalize">
              {supplier.supplier_type}
            </Badge>
          )}
          {supplierCategoryNames.map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
        </div>
      )}

      <Tabs defaultValue="price-locks">
        <TabsList>
          <TabsTrigger value="price-locks">Purchase Lock</TabsTrigger>
          <TabsTrigger value="scans">Scan History</TabsTrigger>
        </TabsList>

        <TabsContent value="price-locks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Locked prices</CardTitle>
              {canManagePrices && (
                <div className="flex gap-2">
                  <PriceLockFormDialog supplierId={supplier.id} />
                  <QuotationScanDialog supplierId={supplier.id} />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {locksLoading ? (
                <FullScreenSpinner />
              ) : currentLocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No locked prices yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Pack</TableHead>
                      <TableHead className="text-right">Agreed Price</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLocks.map((lock) => (
                      <TableRow key={lock.id}>
                        <TableCell>{lock.products?.name}</TableCell>
                        <TableCell>{lock.units?.code}</TableCell>
                        <TableCell className="text-right tabular-nums">{lock.pack_size ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(lock.agreed_price)}
                        </TableCell>
                        <TableCell>
                          {lock.restaurantNames.length === 0 ? (
                            <Badge variant="secondary">All restaurants</Badge>
                          ) : (
                            <span className="text-sm">{lock.restaurantNames.join(', ')}</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(lock.valid_from)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {historicalLocks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Price history</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Valid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicalLocks.map((lock) => (
                      <TableRow key={lock.id}>
                        <TableCell className="text-muted-foreground">{lock.products?.name}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(lock.agreed_price)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(lock.valid_from)} – {formatDate(lock.valid_to)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scans">
          <Card>
            <CardContent className="pt-6">
              {!scanJobs || scanJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents scanned yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.attachments?.file_name ?? '—'}</TableCell>
                        <TableCell>
                          <StatusBadge status={job.status} />
                        </TableCell>
                        <TableCell>{formatDate(job.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SupplierFormDialog supplierId={supplier.id} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}
