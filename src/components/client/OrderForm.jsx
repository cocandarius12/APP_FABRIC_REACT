import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { Upload, X, Loader2, Sparkles } from "lucide-react";

const personalizationLabels = {
  print_dtg: "Print DTG",
  print_screen: "Serigrafie",
  broderie: "Broderie",
  sublimation: "Sublimare",
  patch: "Patch",
  vinyl: "Vinyl"
};

const sizeLabels = {
  small: "Mic (5x5 cm)",
  medium: "Mediu (15x15 cm)",
  large: "Mare (30x30 cm)",
  xlarge: "Extra Mare (A3)"
};

const positionOptions = [
  { id: "fata", label: "Față" },
  { id: "spate", label: "Spate" },
  { id: "maneca_stanga", label: "Mânecă stânga" },
  { id: "maneca_dreapta", label: "Mânecă dreapta" },
  { id: "guler", label: "Guler" }
];

export default function OrderForm({ product, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_company: '',
    quantity: 50,
    color: product?.available_colors?.[0] || '',
    sizes_breakdown: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
    personalization_type: product?.personalization_options?.[0] || 'print_dtg',
    personalization_size: 'medium',
    personalization_positions: ['fata'],
    num_colors: 1,
    logo_url: '',
    special_instructions: '',
    delivery_address: ''
  });
  
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSizeChange = (size, value) => {
    setFormData(prev => ({
      ...prev,
      sizes_breakdown: { ...prev.sizes_breakdown, [size]: parseInt(value) || 0 }
    }));
  };

  const handlePositionToggle = (position) => {
    setFormData(prev => {
      const positions = prev.personalization_positions.includes(position)
        ? prev.personalization_positions.filter(p => p !== position)
        : [...prev.personalization_positions, position];
      return { ...prev, personalization_positions: positions };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      handleChange('logo_url', file_url);
      setLogoPreview(URL.createObjectURL(file));
    } catch (error) {
      console.error('Upload failed:', error);
    }
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      template_id: product.id,
      product_name: product.name
    });
  };

  const totalSizes = Object.values(formData.sizes_breakdown).reduce((a, b) => a + b, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Contact Information */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900">Informații contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Nume complet *</Label>
            <Input
              value={formData.client_name}
              onChange={(e) => handleChange('client_name', e.target.value)}
              placeholder="Ion Popescu"
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Email *</Label>
            <Input
              type="email"
              value={formData.client_email}
              onChange={(e) => handleChange('client_email', e.target.value)}
              placeholder="email@companie.ro"
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Telefon</Label>
            <Input
              value={formData.client_phone}
              onChange={(e) => handleChange('client_phone', e.target.value)}
              placeholder="0722 123 456"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Companie</Label>
            <Input
              value={formData.client_company}
              onChange={(e) => handleChange('client_company', e.target.value)}
              placeholder="Nume SRL"
              className="h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Product Configuration */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900">Configurare produs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Cantitate totală *</Label>
              <Input
                type="number"
                min={product?.min_qty || 10}
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', parseInt(e.target.value))}
                className="h-11"
              />
              <p className="text-xs text-slate-500">Minim {product?.min_qty || 10} bucăți</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Culoare produs</Label>
              <Select value={formData.color} onValueChange={(v) => handleChange('color', v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selectează culoare" />
                </SelectTrigger>
                <SelectContent>
                  {(product?.available_colors || ['Alb', 'Negru', 'Gri']).map(color => (
                    <SelectItem key={color} value={color}>{color}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sizes breakdown */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Distribuție mărimi</Label>
            <div className="grid grid-cols-5 gap-3">
              {['S', 'M', 'L', 'XL', 'XXL'].map(size => (
                <div key={size} className="space-y-1.5">
                  <Label className="text-xs text-slate-500 text-center block">{size}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.sizes_breakdown[size]}
                    onChange={(e) => handleSizeChange(size, e.target.value)}
                    className="h-10 text-center"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Total mărimi: {totalSizes} din {formData.quantity} bucăți
              {totalSizes !== formData.quantity && totalSizes > 0 && (
                <span className="text-amber-600 ml-2">⚠ Diferență de {formData.quantity - totalSizes}</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Personalization */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Personalizare
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Tip personalizare</Label>
              <Select 
                value={formData.personalization_type} 
                onValueChange={(v) => handleChange('personalization_type', v)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(product?.personalization_options || Object.keys(personalizationLabels)).map(opt => (
                    <SelectItem key={opt} value={opt}>{personalizationLabels[opt]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Dimensiune design</Label>
              <Select 
                value={formData.personalization_size} 
                onValueChange={(v) => handleChange('personalization_size', v)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sizeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Positions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Poziții personalizare</Label>
            <div className="flex flex-wrap gap-3">
              {positionOptions.map(pos => (
                <div
                  key={pos.id}
                  onClick={() => handlePositionToggle(pos.id)}
                  className={`
                    px-4 py-2.5 rounded-full border-2 cursor-pointer transition-all
                    ${formData.personalization_positions.includes(pos.id)
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }
                  `}
                >
                  <span className="text-sm font-medium">{pos.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Colors count */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Număr culori în design</Label>
            <Select 
              value={formData.num_colors.toString()} 
              onValueChange={(v) => handleChange('num_colors', parseInt(v))}
            >
              <SelectTrigger className="h-11 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'culoare' : 'culori'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Logo upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Încarcă logo / design</Label>
            <div className="flex items-start gap-4">
              <label className="flex-1">
                <div className={`
                  border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                  ${uploading ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}
                `}>
                  {uploading ? (
                    <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600">Click pentru upload</p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG, AI, PDF</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*,.pdf,.ai"
                  onChange={handleFileUpload}
                />
              </label>
              
              {logoPreview && (
                <div className="relative">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="w-24 h-24 object-contain rounded-lg border bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null);
                      handleChange('logo_url', '');
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery & Instructions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900">Livrare & instrucțiuni</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Adresă livrare</Label>
            <Textarea
              value={formData.delivery_address}
              onChange={(e) => handleChange('delivery_address', e.target.value)}
              placeholder="Strada, număr, cod poștal, oraș"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Instrucțiuni speciale</Label>
            <Textarea
              value={formData.special_instructions}
              onChange={(e) => handleChange('special_instructions', e.target.value)}
              placeholder="Cerințe speciale, detalii despre design, etc."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Button 
        type="submit" 
        disabled={isLoading}
        className="w-full h-14 text-base font-semibold bg-slate-900 hover:bg-slate-800 rounded-xl"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Se calculează oferta...
          </>
        ) : (
          'Obține ofertă instant →'
        )}
      </Button>
    </form>
  );
}