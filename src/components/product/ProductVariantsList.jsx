import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Minus } from "lucide-react";

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const COLORS = ['Alb', 'Negru', 'Navy', 'Gri', 'Roșu', 'Verde', 'Albastru'];

export default function ProductVariantsList({ 
  product, 
  productIndex, 
  zones, 
  onUpdateVariant, 
  onRemoveVariant, 
  onAddVariant,
  onRemoveProduct 
}) {
  const totalQty = (product.variants || []).reduce((sum, v) => 
    sum + Object.values(v.sizes || {}).reduce((s, q) => s + q, 0), 0
  );

  const updateVariantSize = (variantIdx, size, quantity) => {
    const variant = product.variants[variantIdx];
    const newSizes = { ...variant.sizes };
    
    if (quantity > 0) {
      newSizes[size] = quantity;
    } else {
      delete newSizes[size];
    }
    
    onUpdateVariant(productIndex, variantIdx, { ...variant, sizes: newSizes });
  };

  const updateVariantColor = (variantIdx, color) => {
    const variant = product.variants[variantIdx];
    onUpdateVariant(productIndex, variantIdx, { ...variant, color });
  };

  const updateVariantZone = (variantIdx, zone) => {
    const variant = product.variants[variantIdx];
    onUpdateVariant(productIndex, variantIdx, { ...variant, personalization_zone: zone });
  };

  const updateVariantTechnique = (variantIdx, technique) => {
    const variant = product.variants[variantIdx];
    onUpdateVariant(productIndex, variantIdx, { ...variant, personalization_technique: technique });
  };

  return (
    <div className="border-2 border-[#E5E7EB] rounded-xl p-5 bg-white hover:border-[#1F3A5F] transition-all shadow-sm">
      <div className="flex items-start justify-between mb-4 pb-3 border-b border-[#E5E7EB]">
        <div className="flex-1">
          <h4 className="text-[#1F2933] font-semibold text-base">{product.product_name}</h4>
          <p className="text-xs text-[#6B7280] mt-1 font-medium">{totalQty} bucăți total</p>
        </div>
        <button onClick={() => onRemoveProduct(productIndex)} className="text-[#9CA3AF] hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {(product.variants || []).map((variant, variantIdx) => {
          const variantQty = Object.values(variant.sizes || {}).reduce((s, q) => s + q, 0);
          const hasPersonalization = variant.personalization_zone && variant.personalization_zone !== '';
          
          return (
            <div key={variantIdx} className="border-l-4 border-[#1F3A5F] pl-4 py-2 bg-[#F9FAFB] rounded-r-lg relative">
              <button 
                onClick={() => onRemoveVariant(productIndex, variantIdx)}
                className="absolute -left-2 top-2 w-5 h-5 rounded-full bg-[#E5E7EB] hover:bg-red-500 text-[#6B7280] hover:text-white flex items-center justify-center text-xs transition-colors shadow-sm"
              >
                <X className="w-3 h-3" />
              </button>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Select value={variant.color || ''} onValueChange={(c) => updateVariantColor(variantIdx, c)}>
                    <SelectTrigger className="h-10 bg-white border-[#E5E7EB] text-[#1F2933] text-sm flex-1 rounded-lg font-medium">
                      <SelectValue placeholder="Alege culoare" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORS.map(color => (
                        <SelectItem key={color} value={color}>{color}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {variantQty > 0 && (
                    <Badge className="text-xs h-6 px-3 bg-[#1F3A5F] text-white font-semibold">{variantQty} buc</Badge>
                  )}
                  
                  <Badge 
                    variant={hasPersonalization ? "default" : "outline"} 
                    className={`text-xs h-6 px-3 font-medium ${hasPersonalization ? 'bg-[#2FA36B] text-white' : 'border-[#E5E7EB] text-[#6B7280] bg-white'}`}
                  >
                    {hasPersonalization ? 'Cu pers.' : 'Fără pers.'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {SIZES.filter(size => variant.sizes?.[size] && variant.sizes[size] > 0).map(size => (
                    <div key={size} className="flex items-center gap-1.5 bg-white rounded-lg border-2 border-[#E5E7EB] px-3 py-2 shadow-sm">
                      <span className="text-xs font-bold text-[#1F2933] min-w-[20px]">{size}</span>
                      <button 
                        onClick={() => updateVariantSize(variantIdx, size, (variant.sizes[size] || 0) - 1)} 
                        className="w-5 h-5 rounded bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-bold text-[#1F3A5F] min-w-[20px] text-center">{variant.sizes[size]}</span>
                      <button 
                        onClick={() => updateVariantSize(variantIdx, size, (variant.sizes[size] || 0) + 1)} 
                        className="w-5 h-5 rounded bg-[#2FA36B] text-white flex items-center justify-center hover:bg-[#27875a] transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <Select onValueChange={(size) => updateVariantSize(variantIdx, size, 1)}>
                    <SelectTrigger className="h-9 w-20 bg-white border-2 border-dashed border-[#E5E7EB] text-[#6B7280] text-xs px-2 rounded-lg hover:border-[#1F3A5F] transition-colors">
                      <SelectValue placeholder="+ Mărime" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.filter(size => !variant.sizes?.[size] || variant.sizes[size] === 0).map(size => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">Zonă personalizare</label>
                  <Select 
                    value={variant.personalization_zone || ''} 
                    onValueChange={(val) => updateVariantZone(variantIdx, val)}
                  >
                    <SelectTrigger className="h-10 bg-white border-[#E5E7EB] text-[#1F2933] text-xs rounded-lg">
                      <SelectValue placeholder="Alege zonă" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Fără personalizare</SelectItem>
                      {zones.filter(z => z.is_active).map(zone => (
                        <SelectItem key={zone.id_zone} value={zone.id_zone}>{zone.label_client}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">Tehnică</label>
                  <Select 
                    value={variant.personalization_technique || ''} 
                    onValueChange={(val) => updateVariantTechnique(variantIdx, val)}
                    disabled={!hasPersonalization}
                  >
                    <SelectTrigger className="h-10 bg-white border-[#E5E7EB] text-[#1F2933] text-xs rounded-lg disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]">
                      <SelectValue placeholder="Auto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Auto</SelectItem>
                      <SelectItem value="DTG">DTG</SelectItem>
                      <SelectItem value="SERIGRAFIE">Serigrafie</SelectItem>
                      <SelectItem value="BRODERIE">Broderie</SelectItem>
                      <SelectItem value="SUBLIMARE">Sublimare</SelectItem>
                      <SelectItem value="VINIL">Vinil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button 
        onClick={() => onAddVariant(productIndex)}
        variant="outline"
        size="sm"
        className="w-full mt-4 h-10 text-xs font-semibold border-2 border-dashed border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#1F3A5F] hover:text-[#1F3A5F] rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4 mr-2" />
        Adaugă variantă
      </Button>
    </div>
  );
}