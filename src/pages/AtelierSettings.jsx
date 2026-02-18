import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Factory, Save, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const TECHNIQUE_MAPPING = {
  'DTG': { label: 'Print DTG', old_key: 'print_dtg' },
  'SERIGRAFIE': { label: 'Serigrafie', old_key: 'print_screen' },
  'BRODERIE': { label: 'Broderie', old_key: 'broderie' },
  'SUBLIMARE': { label: 'Sublimare', old_key: 'sublimation' },
  'VINIL': { label: 'Vinil', old_key: 'vinyl' }
};

export default function AtelierSettingsPage() {
  const queryClient = useQueryClient();
  
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: ateliers = [] } = useQuery({
    queryKey: ['my-atelier'],
    queryFn: () => base44.entities.Atelier.filter({ contact_email: user?.email }),
    enabled: !!user?.email
  });

  const myAtelier = ateliers[0];

  const [formData, setFormData] = useState({
    name: myAtelier?.name || '',
    city: myAtelier?.city || '',
    contact_phone: myAtelier?.contact_phone || '',
    price_modifier: myAtelier?.price_modifier || 1.0,
    weekly_capacity: myAtelier?.weekly_capacity || 1000,
    avg_lead_time_days: myAtelier?.avg_lead_time_days || 7,
    notes: myAtelier?.notes || '',
    invoice_series: myAtelier?.invoice_series || '',
    county_code: myAtelier?.county_code || '',
    personalization_techniques: myAtelier?.personalization_techniques || []
  });

  React.useEffect(() => {
    if (myAtelier) {
      setFormData({
        name: myAtelier.name || '',
        city: myAtelier.city || '',
        contact_phone: myAtelier.contact_phone || '',
        price_modifier: myAtelier.price_modifier || 1.0,
        weekly_capacity: myAtelier.weekly_capacity || 1000,
        avg_lead_time_days: myAtelier.avg_lead_time_days || 7,
        notes: myAtelier.notes || '',
        invoice_series: myAtelier.invoice_series || '',
        county_code: myAtelier.county_code || '',
        personalization_techniques: myAtelier.personalization_techniques || []
      });
    }
  }, [myAtelier]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Atelier.update(myAtelier.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-atelier']);
      toast.success('Setările au fost salvate');
    },
    onError: () => {
      toast.error('Eroare la salvare');
    }
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateTechnique = (technique, field, value) => {
    setFormData(prev => {
      const techniques = [...prev.personalization_techniques];
      const existingIdx = techniques.findIndex(t => t.technique === technique);
      
      if (existingIdx >= 0) {
        techniques[existingIdx] = {
          ...techniques[existingIdx],
          [field]: field === 'technique' ? value : parseFloat(value) || 0
        };
      } else {
        techniques.push({
          technique,
          cost_per_cm2: field === 'cost_per_cm2' ? parseFloat(value) || 0 : 0,
          min_cost_per_piece: field === 'min_cost_per_piece' ? parseFloat(value) || 0 : 10,
          setup_fee: field === 'setup_fee' ? parseFloat(value) || 0 : 0,
          min_qty: field === 'min_qty' ? parseFloat(value) || 0 : 1,
          max_area_cm2: field === 'max_area_cm2' ? parseFloat(value) || 0 : 1000,
          lead_time_modifier_days: field === 'lead_time_modifier_days' ? parseFloat(value) || 0 : 0,
          price_modifier: field === 'price_modifier' ? parseFloat(value) || 0 : 1.0
        });
      }
      
      return { ...prev, personalization_techniques: techniques };
    });
  };

  const getTechniqueValue = (technique, field) => {
    const tech = formData.personalization_techniques.find(t => t.technique === technique);
    return tech?.[field] || '';
  };

  const removeTechnique = (technique) => {
    setFormData(prev => ({
      ...prev,
      personalization_techniques: prev.personalization_techniques.filter(t => t.technique !== technique)
    }));
  };

  if (!myAtelier) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Niciun atelier asociat</h3>
            <p className="text-slate-600">Contactează administratorul pentru a-ți asocia contul cu un atelier.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Setări Atelier</h1>
            <p className="text-slate-600">Configurează detaliile și prețurile atelierului</p>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="w-4 h-4 mr-2" />
            Salvează modificările
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="general">Informații Generale</TabsTrigger>
            <TabsTrigger value="costs">Costuri Personalizare</TabsTrigger>
            <TabsTrigger value="capacity">Capacitate & Performanță</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Detalii Atelier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nume Atelier</Label>
                    <Input value={formData.name} onChange={(e) => updateField('name', e.target.value)} />
                  </div>
                  <div>
                    <Label>Oraș</Label>
                    <Input value={formData.city} onChange={(e) => updateField('city', e.target.value)} />
                  </div>
                  <div>
                    <Label>Telefon Contact</Label>
                    <Input value={formData.contact_phone} onChange={(e) => updateField('contact_phone', e.target.value)} />
                  </div>
                  <div>
                    <Label>Modificator Preț Global</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.price_modifier}
                      onChange={(e) => updateField('price_modifier', e.target.value)}
                    />
                    <p className="text-xs text-slate-500 mt-1">1.0 = standard, 0.9 = -10%, 1.1 = +10%</p>
                  </div>
                  <div>
                    <Label>Serie Factură (3 litere)</Label>
                    <Input
                      maxLength={3}
                      placeholder="TEX"
                      value={formData.invoice_series}
                      onChange={(e) => updateField('invoice_series', e.target.value.toUpperCase())}
                    />
                    <p className="text-xs text-slate-500 mt-1">Ex: TEX, PRO, ART</p>
                  </div>
                  <div>
                    <Label>Cod Județ (2 litere)</Label>
                    <Input
                      maxLength={2}
                      placeholder="BH"
                      value={formData.county_code}
                      onChange={(e) => updateField('county_code', e.target.value.toUpperCase())}
                    />
                    <p className="text-xs text-slate-500 mt-1">Ex: BH, CJ, TM</p>
                  </div>
                </div>

                <div>
                  <Label>Note / Descriere Servicii</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    rows={4}
                    placeholder="Descriere detaliată servicii, echipamente, experiență..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Tehnici de Personalizare</CardTitle>
                <p className="text-sm text-slate-600">Configurează costurile și parametrii pentru fiecare tehnică oferită</p>
              </CardHeader>
              <CardContent className="space-y-8">
                {Object.entries(TECHNIQUE_MAPPING).map(([technique, config]) => {
                  const hasData = formData.personalization_techniques.some(t => t.technique === technique);
                  
                  return (
                    <div key={technique} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-lg">{config.label}</h4>
                        {hasData && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTechnique(technique)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Elimină
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <Label>Cost/cm² (RON)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.15"
                            value={getTechniqueValue(technique, 'cost_per_cm2')}
                            onChange={(e) => updateTechnique(technique, 'cost_per_cm2', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Cost min/piesă</Label>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="10"
                            value={getTechniqueValue(technique, 'min_cost_per_piece')}
                            onChange={(e) => updateTechnique(technique, 'min_cost_per_piece', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Taxa setup</Label>
                          <Input
                            type="number"
                            step="1"
                            placeholder="30"
                            value={getTechniqueValue(technique, 'setup_fee')}
                            onChange={(e) => updateTechnique(technique, 'setup_fee', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Cantitate min</Label>
                          <Input
                            type="number"
                            placeholder="1"
                            value={getTechniqueValue(technique, 'min_qty')}
                            onChange={(e) => updateTechnique(technique, 'min_qty', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Arie max (cm²)</Label>
                          <Input
                            type="number"
                            placeholder="1000"
                            value={getTechniqueValue(technique, 'max_area_cm2')}
                            onChange={(e) => updateTechnique(technique, 'max_area_cm2', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Lead time +/- (zile)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={getTechniqueValue(technique, 'lead_time_modifier_days')}
                            onChange={(e) => updateTechnique(technique, 'lead_time_modifier_days', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Modificator preț</Label>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="1.0"
                            value={getTechniqueValue(technique, 'price_modifier')}
                            onChange={(e) => updateTechnique(technique, 'price_modifier', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capacity" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Capacitate & Performanță</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Lead Time Mediu (zile)</Label>
                    <Input
                      type="number"
                      value={formData.avg_lead_time_days}
                      onChange={(e) => updateField('avg_lead_time_days', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Capacitate Săptămânală (unități)</Label>
                    <Input
                      type="number"
                      value={formData.weekly_capacity}
                      onChange={(e) => updateField('weekly_capacity', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}