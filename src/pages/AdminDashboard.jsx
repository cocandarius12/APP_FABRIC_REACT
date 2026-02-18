import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, Users, Factory, TrendingUp, Clock, AlertTriangle, 
  CheckCircle, DollarSign, Calendar, Filter, RefreshCw
} from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval, subDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import StatsCard from '@/components/admin/StatsCard';
import OrdersTable from '@/components/admin/OrdersTable';
import AtelierCard from '@/components/admin/AtelierCard';

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: orders = [], isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 100)
  });

  const { data: ateliers = [], isLoading: loadingAteliers } = useQuery({
    queryKey: ['all-ateliers'],
    queryFn: () => base44.entities.Atelier.list()
  });

  const { data: products = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: () => base44.entities.ProductTemplate.list()
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-orders']);
    }
  });

  // Calculate stats
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  
  const thisWeekOrders = orders.filter(o => 
    o.created_date && isWithinInterval(new Date(o.created_date), { start: weekStart, end: weekEnd })
  );
  
  const activeOrdersCount = orders.filter(o => 
    ['accepted', 'in_production', 'qa', 'ready_for_shipping'].includes(o.status)
  ).length;
  
  const totalRevenue = orders
    .filter(o => !['cancelled', 'draft'].includes(o.status))
    .reduce((sum, o) => sum + (o.total_price || 0), 0);
  
  const avgLeadTime = orders.length > 0 
    ? orders.reduce((sum, o) => sum + (o.estimated_lead_time_days || 0), 0) / orders.length 
    : 0;

  const onTimeRate = orders.filter(o => o.status === 'delivered').length > 0
    ? Math.round((orders.filter(o => o.status === 'delivered').length / orders.length) * 100)
    : 0;

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (dateFilter === 'today') {
      const today = new Date().toDateString();
      return new Date(order.created_date).toDateString() === today;
    }
    if (dateFilter === 'week') {
      return order.created_date && isWithinInterval(new Date(order.created_date), { start: weekStart, end: weekEnd });
    }
    if (dateFilter === 'month') {
      const monthAgo = subDays(now, 30);
      return order.created_date && new Date(order.created_date) >= monthAgo;
    }
    return true;
  });

  const handleUpdateStatus = async (order, newStatus) => {
    await updateOrderMutation.mutateAsync({
      id: order.id,
      data: { status: newStatus }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>
            <p className="text-slate-500">Gestionează comenzi, ateliere și producție</p>
          </div>
          <Button variant="outline" onClick={() => refetchOrders()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizează
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border mb-6">
            <TabsTrigger value="overview">Prezentare generală</TabsTrigger>
            <TabsTrigger value="orders">Comenzi ({orders.length})</TabsTrigger>
            <TabsTrigger value="ateliers">Ateliere ({ateliers.length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Comenzi active"
                value={activeOrdersCount}
                icon={Package}
                color="blue"
                trend="up"
                trendValue={`+${thisWeekOrders.length} săptămâna aceasta`}
              />
              <StatsCard
                title="Venituri totale"
                value={`${(totalRevenue / 1000).toFixed(0)}K RON`}
                icon={DollarSign}
                color="green"
              />
              <StatsCard
                title="Lead time mediu"
                value={`${avgLeadTime.toFixed(1)} zile`}
                icon={Clock}
                color="amber"
              />
              <StatsCard
                title="Ateliere active"
                value={ateliers.filter(a => a.status === 'active').length}
                icon={Factory}
                color="purple"
              />
            </div>

            {/* Quick Stats */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Recent Orders */}
              <Card className="lg:col-span-2 border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-semibold">Comenzi recente</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('orders')}>
                    Vezi toate →
                  </Button>
                </CardHeader>
                <CardContent>
                  <OrdersTable 
                    orders={orders.slice(0, 5)} 
                    onView={setSelectedOrder}
                    onUpdateStatus={handleUpdateStatus}
                  />
                </CardContent>
              </Card>

              {/* Atelier Performance */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Top ateliere</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ateliers
                    .filter(a => a.status === 'active')
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .slice(0, 5)
                    .map((atelier, idx) => (
                      <div key={atelier.id} className="flex items-center gap-3">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                          ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}
                        `}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{atelier.name}</p>
                          <p className="text-xs text-slate-500">{atelier.city}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{atelier.score?.toFixed(1) || '-'}</p>
                          <p className="text-xs text-slate-500">scor</p>
                        </div>
                      </div>
                    ))
                  }
                </CardContent>
              </Card>
            </div>

            {/* Status Distribution */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Distribuție comenzi după status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { status: 'accepted', label: 'Acceptate', color: 'bg-emerald-500' },
                    { status: 'in_production', label: 'În producție', color: 'bg-amber-500' },
                    { status: 'qa', label: 'QA', color: 'bg-purple-500' },
                    { status: 'shipped', label: 'Expediate', color: 'bg-blue-500' },
                    { status: 'delivered', label: 'Finalizate', color: 'bg-green-500' }
                  ].map(item => {
                    const count = orders.filter(o => o.status === item.status).length;
                    const percent = orders.length > 0 ? (count / orders.length * 100).toFixed(0) : 0;
                    return (
                      <div key={item.status} className="text-center p-4 bg-slate-50 rounded-xl">
                        <div className={`w-3 h-3 ${item.color} rounded-full mx-auto mb-2`} />
                        <p className="text-2xl font-bold text-slate-900">{count}</p>
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className="text-xs text-slate-400 mt-1">{percent}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate statusurile</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="offer_sent">Ofertă trimisă</SelectItem>
                    <SelectItem value="accepted">Acceptate</SelectItem>
                    <SelectItem value="in_production">În producție</SelectItem>
                    <SelectItem value="qa">QA</SelectItem>
                    <SelectItem value="shipped">Expediate</SelectItem>
                    <SelectItem value="delivered">Finalizate</SelectItem>
                    <SelectItem value="cancelled">Anulate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Perioadă" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate</SelectItem>
                    <SelectItem value="today">Azi</SelectItem>
                    <SelectItem value="week">Săptămâna aceasta</SelectItem>
                    <SelectItem value="month">Ultima lună</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <OrdersTable 
              orders={filteredOrders} 
              onView={setSelectedOrder}
              onUpdateStatus={handleUpdateStatus}
            />
          </TabsContent>

          {/* Ateliers Tab */}
          <TabsContent value="ateliers" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ateliers.map(atelier => (
                <AtelierCard 
                  key={atelier.id}
                  atelier={atelier}
                  onEdit={() => {}}
                  onViewOrders={() => {
                    setStatusFilter('all');
                    setActiveTab('orders');
                  }}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}