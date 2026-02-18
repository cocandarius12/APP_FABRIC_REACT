import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Package, Clock, CheckCircle, Factory, Camera, Truck, 
  AlertTriangle, Calendar, Upload, X, Loader2, Download, Eye, ArrowLeft
} from "lucide-react";
import { downloadAtelierSummaryHTML } from '@/components/order/AtelierSummaryHTMLGenerator';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

const statusConfig = {
  offer_sent: { label: 'Nouă', color: 'bg-blue-100 text-blue-700', next: 'accepted', nextLabel: 'Acceptă comanda', prev: null },
  accepted: { label: 'Acceptată', color: 'bg-emerald-100 text-emerald-700', next: 'in_production', nextLabel: 'Începe producția', prev: 'offer_sent' },
  in_production: { label: 'În producție', color: 'bg-amber-100 text-amber-700', next: 'qa', nextLabel: 'Trimite la QA', prev: 'accepted' },
  qa: { label: 'Control calitate', color: 'bg-purple-100 text-purple-700', next: 'ready_for_shipping', nextLabel: 'Confirmă QA', prev: 'in_production' },
  ready_for_shipping: { label: 'Gata livrare', color: 'bg-cyan-100 text-cyan-700', next: 'shipped', nextLabel: 'Marchează expediat', prev: 'qa' },
  shipped: { label: 'Expediat', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Finalizată', color: 'bg-green-100 text-green-700' }
};

export default function AtelierPortalPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showQADialog, setShowQADialog] = useState(false);
  const [qaPhotos, setQaPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: ateliers = [] } = useQuery({
    queryKey: ['user-ateliers'],
    queryFn: () => base44.entities.Atelier.filter({ contact_email: user?.email }),
    enabled: !!user?.email
  });

  const currentAtelier = ateliers[0]; // Pentru simplitate, luăm primul atelier

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['atelier-orders', currentAtelier?.id],
    queryFn: () => base44.entities.Order.filter({ atelier_id: currentAtelier?.id }, '-created_date'),
    enabled: !!currentAtelier?.id
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['atelier-orders']);
      setSelectedOrder(null);
      setShowQADialog(false);
      setQaPhotos([]);
      setTrackingNumber('');
    }
  });

  const pendingOrders = orders.filter(o => o.status === 'offer_sent');
  const acceptedOrders = orders.filter(o => o.status === 'accepted');
  const inProgressOrders = orders.filter(o => ['in_production', 'qa'].includes(o.status));
  const readyOrders = orders.filter(o => o.status === 'ready_for_shipping');
  const completedOrders = orders.filter(o => ['shipped', 'delivered', 'closed'].includes(o.status));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    setUploading(true);
    
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setQaPhotos(prev => [...prev, file_url]);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
    setUploading(false);
  };

  const handleAdvanceStatus = async (order) => {
    const config = statusConfig[order.status];
    if (!config) return;

    if (order.status === 'in_production') {
      setSelectedOrder(order);
      setShowQADialog(true);
      return;
    }

    if (order.status === 'ready_for_shipping') {
      setSelectedOrder(order);
      return;
    }

    await updateOrderMutation.mutateAsync({
      id: order.id,
      data: { status: config.next }
    });
  };

  const handleRevertStatus = async (order) => {
    const config = statusConfig[order.status];
    if (!config?.prev) return;

    await updateOrderMutation.mutateAsync({
      id: order.id,
      data: { status: config.prev }
    });
  };

  const handleSubmitQA = async () => {
    if (!selectedOrder || qaPhotos.length === 0) {
      return;
    }
    
    await updateOrderMutation.mutateAsync({
      id: selectedOrder.id,
      data: { 
        status: 'ready_for_shipping',
        qa_photos: qaPhotos
      }
    });
  };

  const handleDeleteQAPhoto = async (order, photoIndex) => {
    const updatedPhotos = order.qa_photos.filter((_, i) => i !== photoIndex);
    await updateOrderMutation.mutateAsync({
      id: order.id,
      data: { qa_photos: updatedPhotos }
    });
  };

  const handleMarkShipped = async () => {
    if (!selectedOrder) return;
    
    if (!trackingNumber || trackingNumber.trim() === '') {
      return;
    }
    
    await updateOrderMutation.mutateAsync({
      id: selectedOrder.id,
      data: { 
        status: 'shipped',
        tracking_number: trackingNumber
      }
    });
  };

  if (!currentAtelier) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Factory className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-semibold mb-2">Niciun atelier asociat</h2>
            <p className="text-slate-500">
              Contul tău nu este asociat cu niciun atelier. Contactează administratorul pentru acces.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">{currentAtelier.name}</h1>
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                Activ
              </Badge>
            </div>
            <p className="text-slate-500">{currentAtelier.city}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-500">Încărcare curentă</p>
              <p className="font-semibold">{currentAtelier.current_load_percent || 0}%</p>
            </div>
            <Progress value={currentAtelier.current_load_percent || 0} className="w-24 h-2" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{pendingOrders.length}</p>
                  <p className="text-xs text-slate-500">Noi</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Factory className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{inProgressOrders.length}</p>
                  <p className="text-xs text-slate-500">În lucru</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{readyOrders.length}</p>
                  <p className="text-xs text-slate-500">Gata livrare</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{completedOrders.length}</p>
                  <p className="text-xs text-slate-500">Finalizate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border mb-6">
            <TabsTrigger value="pending">
              Noi ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="accepted">
              Acceptate ({acceptedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              În lucru ({inProgressOrders.length})
            </TabsTrigger>
            <TabsTrigger value="ready">
              Gata livrare ({readyOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Finalizate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <OrdersList 
              orders={pendingOrders} 
              onAdvance={handleAdvanceStatus}
              onRevert={handleRevertStatus}
              isUpdating={updateOrderMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="accepted">
            <OrdersList 
              orders={acceptedOrders} 
              onAdvance={handleAdvanceStatus}
              onRevert={handleRevertStatus}
              isUpdating={updateOrderMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="in_progress">
            <OrdersList 
              orders={inProgressOrders} 
              onAdvance={handleAdvanceStatus}
              onRevert={handleRevertStatus}
              isUpdating={updateOrderMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="ready">
            <OrdersList 
              orders={readyOrders} 
              onAdvance={handleAdvanceStatus}
              onRevert={handleRevertStatus}
              isUpdating={updateOrderMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="completed">
            <OrdersList 
              orders={completedOrders} 
              showActions={false}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* QA Dialog */}
      <Dialog open={showQADialog} onOpenChange={setShowQADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Control calitate - Adaugă fotografii</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Încarcă fotografii ale produselor finite pentru verificare înainte de expediere.
            </p>
            
            <label className="block">
              <div className={`
                border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                ${uploading ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}
              `}>
                {uploading ? (
                  <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600">Click pentru upload fotografii</p>
                  </>
                )}
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
              />
            </label>
            
            {qaPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {qaPhotos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square">
                    <img src={url} alt={`QA ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => setQaPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQADialog(false)}>Anulează</Button>
            <Button onClick={handleSubmitQA} disabled={updateOrderMutation.isPending}>
              {updateOrderMutation.isPending ? 'Se salvează...' : 'Confirmă QA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipping Dialog */}
      <Dialog open={!!selectedOrder && selectedOrder.status === 'ready_for_shipping'} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marchează ca expediat</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Număr tracking AWB *</Label>
              <Input
                placeholder="AWB sau număr colet"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500 mt-1">* Câmp obligatoriu</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>Anulează</Button>
            <Button onClick={handleMarkShipped} disabled={updateOrderMutation.isPending || !trackingNumber.trim()}>
              {updateOrderMutation.isPending ? 'Se salvează...' : 'Confirmă expediere'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersList({ orders, onAdvance, onRevert, isUpdating, showActions = true }) {
  const [viewOrder, setViewOrder] = useState(null);
  const queryClient = useQueryClient();
  
  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['atelier-orders']);
    }
  });

  const handleDeleteQAPhoto = async (order, photoIndex) => {
    const updatedPhotos = order.qa_photos.filter((_, i) => i !== photoIndex);
    await updateOrderMutation.mutateAsync({
      id: order.id,
      data: { qa_photos: updatedPhotos }
    });
  };
  
  if (orders.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">Nu există comenzi în această categorie</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {orders.map(order => {
          const status = statusConfig[order.status];
          const deadline = order.estimated_delivery_date 
            ? new Date(order.estimated_delivery_date)
            : addDays(new Date(order.created_date), order.estimated_lead_time_days || 7);
          
          return (
            <Card key={order.id} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{order.order_number || `#${order.id.slice(-6)}`}</h3>
                      <Badge className={status?.color || 'bg-slate-100'}>
                        {status?.label || order.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-slate-500">Comandă</p>
                        <p className="font-medium">{order.order_number || `#${order.id.slice(-6)}`}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Client</p>
                        <p className="font-medium">{order.client_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Cantitate</p>
                        <p className="font-medium">{order.quantity} buc</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total</p>
                        <p className="font-medium">{order.total_price?.toFixed(2) || '0'} RON</p>
                      </div>
                    </div>
                    
                    {order.special_instructions && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          {order.special_instructions}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setViewOrder(order)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Detalii complete
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAtelierSummaryHTML(order)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descarcă PDF
                    </Button>
                    {showActions && (
                      <div className="flex gap-2">
                        {status?.prev && onRevert && (
                          <Button 
                            variant="outline"
                            onClick={() => onRevert(order)}
                            disabled={isUpdating}
                            size="sm"
                            className="flex-1"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </Button>
                        )}
                        {status?.next && (
                          <Button 
                            onClick={() => onAdvance(order)}
                            disabled={isUpdating}
                            className="bg-slate-900 hover:bg-slate-800 flex-1"
                            size="sm"
                          >
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            {status.nextLabel} →
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalii complete comandă</DialogTitle>
          </DialogHeader>
          
          {viewOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Număr comandă</p>
                  <p className="font-semibold">{viewOrder.order_number || `#${viewOrder.id.slice(-6)}`}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <Badge className={statusConfig[viewOrder.status]?.color}>
                    {statusConfig[viewOrder.status]?.label || viewOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-500">Client</p>
                  <p className="font-semibold">{viewOrder.client_name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-semibold">{viewOrder.client_email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Telefon</p>
                  <p className="font-semibold">{viewOrder.client_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Companie</p>
                  <p className="font-semibold">{viewOrder.client_company || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500">Adresă livrare</p>
                  <p className="font-semibold">{viewOrder.delivery_address || '-'}</p>
                </div>
                {viewOrder.tracking_number && (
                  <div className="col-span-2">
                    <p className="text-slate-500">AWB / Tracking</p>
                    <p className="font-semibold font-mono">{viewOrder.tracking_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500">Data comandă</p>
                  <p className="font-semibold">{viewOrder.created_date && format(new Date(viewOrder.created_date), 'dd.MM.yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Lead time estimat</p>
                  <p className="font-semibold">{viewOrder.estimated_lead_time_days || '-'} zile</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Detalii produse</h3>
                {viewOrder.order_items ? (
                  <div className="space-y-3">
                    {viewOrder.order_items.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg">
                        <div className="font-medium mb-2">{item.product_name} - {item.color}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500">Cantitate:</span> {item.quantity} buc
                          </div>
                          <div>
                            <span className="text-slate-500">Cost/buc produs:</span> {item.base_product_cost?.toFixed(2) || '-'} RON
                          </div>
                          <div>
                            <span className="text-slate-500">Personalizare/buc:</span> {item.personalization_cost_per_unit?.toFixed(2) || '-'} RON
                          </div>
                          <div>
                            <span className="text-slate-500">Mărimi:</span> {Object.entries(item.sizes_breakdown || {}).map(([s, q]) => `${s}:${q}`).join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="text-sm">
                      <p className="text-slate-500">Personalizare: {viewOrder.personalization_type}</p>
                      <p className="text-slate-500">Zonă: {viewOrder.personalization_zone}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Produs</p>
                      <p className="font-semibold">{viewOrder.product_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Cantitate</p>
                      <p className="font-semibold">{viewOrder.quantity} bucăți</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Culoare</p>
                      <p className="font-semibold">{viewOrder.color || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Personalizare</p>
                      <p className="font-semibold">{viewOrder.personalization_type || '-'}</p>
                    </div>
                    {viewOrder.personalization_zone && (
                      <div>
                        <p className="text-slate-500">Zonă</p>
                        <p className="font-semibold">{viewOrder.personalization_zone}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {viewOrder.special_instructions && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Instrucțiuni speciale</h3>
                  <p className="text-sm bg-amber-50 p-3 rounded-lg">{viewOrder.special_instructions}</p>
                </div>
              )}

              {viewOrder.qa_photos && viewOrder.qa_photos.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Fotografii QA</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {viewOrder.qa_photos.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt={`QA ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border" />
                        <button
                          onClick={() => handleDeleteQAPhoto(viewOrder, idx)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Detalii financiare</h3>
                {viewOrder.order_items ? (
                  <div className="space-y-2">
                    {viewOrder.order_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-slate-500">{item.product_name} ({item.quantity} buc)</span>
                        <span className="font-medium">{item.total_price?.toFixed(2)} RON</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t text-base">
                      <span className="font-bold">TOTAL</span>
                      <span className="font-bold">{viewOrder.total_price?.toFixed(2) || '0.00'} RON</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {viewOrder.unit_price && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Preț unitar</span>
                        <span className="font-medium">{viewOrder.unit_price.toFixed(2)} RON</span>
                      </div>
                    )}
                    {viewOrder.setup_fee && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Taxă setup</span>
                        <span className="font-medium">{viewOrder.setup_fee.toFixed(2)} RON</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t text-base">
                      <span className="font-semibold">Total comandă</span>
                      <span className="font-bold">{viewOrder.total_price?.toFixed(2) || '0.00'} RON</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => downloadAtelierSummaryHTML(viewOrder)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descarcă sumar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}