import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shirt, ArrowRight } from "lucide-react";

const categoryIcons = {
  tricouri: "👕",
  hanorace: "🧥",
  polo: "👔",
  geci: "🧥",
  accesorii: "🎒",
  textile_casa: "🏠"
};

export default function ProductCard({ product, onSelect }) {
  return (
    <Card 
      className="group cursor-pointer overflow-hidden border-0 bg-white shadow-sm hover:shadow-xl transition-all duration-500"
      onClick={() => onSelect(product)}
    >
      <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl opacity-30">{categoryIcons[product.category] || "👕"}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              {product.category?.replace('_', ' ')}
            </p>
            <h3 className="font-semibold text-slate-900 leading-tight">
              {product.name}
            </h3>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-4">
          {product.personalization_options?.slice(0, 3).map((opt) => (
            <Badge 
              key={opt} 
              variant="secondary" 
              className="text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              {opt.replace('_', ' ')}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-400">de la</span>
            <p className="text-lg font-bold text-slate-900">
              {product.base_cost?.toFixed(0)} <span className="text-sm font-normal text-slate-500">RON</span>
            </p>
          </div>
          <Button 
            size="sm" 
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-4 group-hover:translate-x-0.5 transition-transform"
          >
            Configurează
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}