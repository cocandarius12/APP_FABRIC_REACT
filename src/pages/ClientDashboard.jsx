import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Clock, CheckCircle, Truck, Plus, Eye, FileText, MessageCircle, Download } from "lucide-react";
import { downloadInvoiceHTML } from '@/components/order/InvoiceHTMLGenerator';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import OrderStatusTracker from '@/components/client/OrderStatusTracker';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: FileText },
  offer_sent: { label: 'Ofertă trimisă', color: 'bg-blue-100 text-blue-700', icon: Clock },
  accepted: { label: 'Acceptată', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  in_production: { label: 'În producție', color: 'bg-amber-100 text-amber-700', icon: Package },
  qa: { label: 'Control calitate', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  ready_for_shipping: { label: 'Gata livrare', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
  shipped: { label: 'Expediată', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Finalizată', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Închisă', color: 'bg-slate-100 text-slate-700', icon: CheckCircle },
  cancelled: { label: 'Anulată', color: 'bg-red-100 text-red-700', icon: FileText }
};

export default function ClientDashboardPage() {
  const [activeTab, setActiveTab] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['client-orders', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Order.filter({ client_email: user?.email }, '-created_date');
    },
    enabled: !!user?.email,
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  });

  const activeOrders = orders.filter(o => 
    !['delivered', 'closed', 'cancelled'].includes(o.status)
  );
  const completedOrders = orders.filter(o => 
    ['delivered', 'closed', 'cancelled'].includes(o.status)
  );

  const displayedOrders = activeTab === 'active' ? activeOrders : completedOrders;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Comenzile mele</h1>
            <p className="text-slate-500">Urmărește statusul comenzilor tale</p>
          </div>
          <Link to={createPageUrl('CatalogWithQuickQuote')}>
            <Button className="bg-slate-900 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" />
              Comandă nouă
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{orders.length}</p>
                  <p className="text-xs text-slate-500">Total comenzi</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{activeOrders.length}</p>
                  <p className="text-xs text-slate-500">În derulare</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{completedOrders.length}</p>
                  <p className="text-xs text-slate-500">Finalizate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {orders.filter(o => o.status === 'shipped').length}
                  </p>
                  <p className="text-xs text-slate-500">În livrare</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="active" className="data-[state=active]:bg-white">
              Active ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-white">
              Finalizate ({completedOrders.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="w-20 h-20 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayedOrders.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <Package className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Nicio comandă</h3>
              <p className="text-slate-500 mb-6">Nu ai comenzi în această categorie</p>
              <Link to={createPageUrl('CatalogWithQuickQuote')}>
                <Button>Plasează prima comandă</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayedOrders.map(order => {
              const status = statusConfig[order.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              
              return (
                <Card 
                  key={order.id} 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Package className="w-8 h-8 text-slate-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="font-semibold text-slate-900">{order.product_name}</h3>
                            <p className="text-sm text-slate-500">
                              {order.order_number || `#${order.id.slice(-6)}`} • {order.quantity} bucăți
                            </p>
                          </div>
                          <Badge className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>{order.order_number || `#${order.id.slice(-6)}`}</span>
                          <span>•</span>
                          <span>
                            {order.created_date && format(new Date(order.created_date), 'd MMMM yyyy', { locale: ro })}
                          </span>
                          {order.estimated_delivery_date && (
                            <>
                              <span>•</span>
                              <span>Livrare: {format(new Date(order.estimated_delivery_date), 'd MMM', { locale: ro })}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {order.total_price?.toLocaleString('ro-RO')} RON
                        </p>
                        <Button variant="ghost" size="sm" className="mt-1">
                          <Eye className="w-4 h-4 mr-1" />
                          Detalii
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalii comandă</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              <OrderStatusTracker order={selectedOrder} />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Număr comandă</p>
                  <p className="font-semibold">{selectedOrder.order_number || `#${selectedOrder.id.slice(-6)}`}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Data plasării</p>
                  <p className="font-semibold">
                    {selectedOrder.created_date && format(new Date(selectedOrder.created_date), 'd MMMM yyyy', { locale: ro })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Produs</p>
                  <p className="font-semibold">{selectedOrder.product_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Cantitate</p>
                  <p className="font-semibold">{selectedOrder.quantity} bucăți</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Personalizare</p>
                  <p className="font-semibold capitalize">{selectedOrder.personalization_type?.replace('_', ' ')}</p>
                </div>
                {selectedOrder.personalization_zone && (
                  <div>
                    <p className="text-sm text-slate-500">Zonă personalizare</p>
                    <p className="font-semibold">{selectedOrder.personalization_zone}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500">Atelier producție</p>
                  <p className="font-semibold">{selectedOrder.atelier_name || '-'}</p>
                </div>
                {selectedOrder.estimated_lead_time_days && (
                  <div>
                    <p className="text-sm text-slate-500">Lead time estimat</p>
                    <p className="font-semibold">{selectedOrder.estimated_lead_time_days} zile</p>
                  </div>
                )}
              </div>
              
              {selectedOrder.tracking_number && (
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-sm text-blue-600 mb-1">Număr tracking</p>
                  <p className="font-mono font-semibold text-blue-900">{selectedOrder.tracking_number}</p>
                </div>
              )}
              
              {selectedOrder.qa_photos && selectedOrder.qa_photos.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Fotografii control calitate</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedOrder.qa_photos.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={url} 
                          alt={`QA ${idx + 1}`} 
                          className="w-full h-32 object-cover rounded-lg hover:scale-105 transition-transform cursor-pointer border-2 border-slate-200" 
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.logo_url && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Fișiere comandă</h3>
                  <a href={selectedOrder.logo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
                    <FileText className="w-4 h-4" />
                    Vezi design/logo
                  </a>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Detalii cost</h3>
                {selectedOrder.order_items ? (
                  <div className="space-y-3">
                    {selectedOrder.order_items.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg">
                        <div className="font-medium text-sm mb-2">{item.product_name} - {item.color}</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Cost/buc produs:</span>
                            <span>{item.base_product_cost?.toFixed(2)} RON</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Personalizare/buc:</span>
                            <span>{item.personalization_cost_per_unit?.toFixed(2)} RON</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{item.quantity} buc × {(item.base_product_cost + item.personalization_cost_per_unit)?.toFixed(2)}</span>
                            <span>{(item.quantity * ((item.base_product_cost || 0) + (item.personalization_cost_per_unit || 0))).toFixed(2)} RON</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Setup</span>
                            <span>{item.setup_fee?.toFixed(2)} RON</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Mărimi:</span>
                            <span className="text-xs">{Object.entries(item.sizes_breakdown || {}).map(([s, q]) => `${s}:${q}`).join(', ')}</span>
                          </div>
                          <div className="flex justify-between font-medium pt-1 border-t">
                            <span>Subtotal</span>
                            <span>{item.total_price?.toFixed(2)} RON</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t text-lg">
                      <span className="font-bold">TOTAL COMANDĂ</span>
                      <span className="font-bold">{selectedOrder.total_price?.toLocaleString('ro-RO')} RON</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {selectedOrder.unit_price && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Preț unitar</span>
                        <span className="font-medium">{selectedOrder.unit_price.toFixed(2)} RON</span>
                      </div>
                    )}
                    {selectedOrder.setup_fee && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Taxă setup</span>
                        <span className="font-medium">{selectedOrder.setup_fee.toFixed(2)} RON</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t text-lg">
                      <span className="font-semibold">Total comandă</span>
                      <span className="font-bold">{selectedOrder.total_price?.toLocaleString('ro-RO')} RON</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={async () => {
                    const { data: settings } = await base44.entities.CompanySettings.list();
                    const companySettings = settings?.[0];
                    downloadInvoiceHTML(selectedOrder, companySettings);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descarcă factură
                </Button>
                <Button variant="outline" className="flex-1">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Suport
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}