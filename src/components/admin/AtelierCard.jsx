import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, Star, Clock, AlertTriangle, Settings, TrendingUp } from "lucide-react";

const skillLabels = {
  print_dtg: "DTG",
  print_screen: "Serigrafie",
  broderie: "Broderie",
  sublimation: "Sublimare",
  patch: "Patch",
  vinyl: "Vinyl"
};

export default function AtelierCard({ atelier, onEdit, onViewOrders }) {
  const loadColor = atelier.current_load_percent > 80 ? 'bg-red-500' : 
                    atelier.current_load_percent > 50 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-slate-900">{atelier.name}</h3>
              <Badge 
                variant="outline" 
                className={atelier.status === 'active' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200'}
              >
                {atelier.status === 'active' ? 'Activ' : 'Inactiv'}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {atelier.city}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onEdit(atelier)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {atelier.skills?.map(skill => (
            <Badge key={skill} variant="secondary" className="text-xs bg-slate-100">
              {skillLabels[skill] || skill}
            </Badge>
          ))}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              <Clock className="w-3 h-3" />
              Lead time
            </div>
            <p className="font-semibold text-slate-900">{atelier.avg_lead_time_days} zile</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              <AlertTriangle className="w-3 h-3" />
              Eroare
            </div>
            <p className="font-semibold text-slate-900">{atelier.error_rate_percent || 0}%</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              <Star className="w-3 h-3" />
              Scor
            </div>
            <p className="font-semibold text-slate-900">{atelier.score?.toFixed(1) || '-'}</p>
          </div>
        </div>

        {/* Capacity */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-500">Încărcare curentă</span>
            <span className="font-medium">{atelier.current_load_percent || 0}%</span>
          </div>
          <Progress value={atelier.current_load_percent || 0} className="h-2" />
          <p className="text-xs text-slate-400 mt-1">
            Capacitate: {atelier.capacity_per_week} buc/săptămână
          </p>
        </div>

        {/* Price info */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500">Modificator preț</p>
            <p className="font-semibold flex items-center gap-1">
              {atelier.price_modifier ? `${(atelier.price_modifier * 100).toFixed(0)}%` : '100%'}
              {atelier.price_modifier < 1 && <TrendingUp className="w-3 h-3 text-emerald-500" />}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onViewOrders(atelier)}>
            Vezi comenzi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}