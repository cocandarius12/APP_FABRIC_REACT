import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, MoreVertical, Truck, CheckCircle, XCircle, Factory } from "lucide-react";
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  offer_sent: { label: 'Ofertă trimisă', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Acceptată', color: 'bg-emerald-100 text-emerald-700' },
  in_production: { label: 'În producție', color: 'bg-amber-100 text-amber-700' },
  qa: { label: 'QA', color: 'bg-purple-100 text-purple-700' },
  ready_for_shipping: { label: 'Gata livrare', color: 'bg-cyan-100 text-cyan-700' },
  shipped: { label: 'Expediată', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Finalizată', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Închisă', color: 'bg-slate-100 text-slate-700' },
  cancelled: { label: 'Anulată', color: 'bg-red-100 text-red-700' }
};

export default function OrdersTable({ orders, onView, onUpdateStatus }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Comandă</TableHead>
            <TableHead className="font-semibold">Client</TableHead>
            <TableHead className="font-semibold">Produs</TableHead>
            <TableHead className="font-semibold text-center">Cantitate</TableHead>
            <TableHead className="font-semibold">Atelier</TableHead>
            <TableHead className="font-semibold text-right">Valoare</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Data</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onView(order)}>
              <TableCell className="font-mono text-sm font-medium">
                {order.order_number || `#${order.id.slice(-6)}`}
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-slate-900">{order.client_name}</p>
                  <p className="text-xs text-slate-500">{order.client_company || order.client_email}</p>
                </div>
              </TableCell>
              <TableCell>
                <p className="font-medium">{order.product_name}</p>
                <p className="text-xs text-slate-500">{order.personalization_type?.replace('_', ' ')}</p>
              </TableCell>
              <TableCell className="text-center font-semibold">{order.quantity}</TableCell>
              <TableCell>
                <p className="text-sm">{order.atelier_name || '-'}</p>
              </TableCell>
              <TableCell className="text-right font-semibold">
                {order.total_price?.toLocaleString('ro-RO')} RON
              </TableCell>
              <TableCell>
                <Badge className={statusConfig[order.status]?.color || statusConfig.draft.color}>
                  {statusConfig[order.status]?.label || order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {order.created_date && format(new Date(order.created_date), 'd MMM', { locale: ro })}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(order)}>
                      <Eye className="w-4 h-4 mr-2" /> Vezi detalii
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateStatus(order, 'in_production')}>
                      <Factory className="w-4 h-4 mr-2" /> Marchează în producție
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateStatus(order, 'shipped')}>
                      <Truck className="w-4 h-4 mr-2" /> Marchează expediat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateStatus(order, 'delivered')}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Marchează livrat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateStatus(order, 'cancelled')} className="text-red-600">
                      <XCircle className="w-4 h-4 mr-2" /> Anulează
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                Nu există comenzi
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}