import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Zap, Award, Truck } from "lucide-react";
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

const offerStyles = {
  rapid: {
    icon: Zap,
    label: "Rapid",
    gradient: "from-amber-500 to-orange-500",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700"
  },
  economic: {
    icon: Check,
    label: "Economic",
    gradient: "from-emerald-500 to-green-500",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700"
  },
  premium: {
    icon: Award,
    label: "Premium",
    gradient: "from-violet-500 to-purple-500",
    bgLight: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700"
  }
};

export default function OfferCard({ offer, type, isSelected, onSelect, quantity }) {
  const style = offerStyles[type];
  const Icon = style.icon;
  const deliveryDate = addDays(new Date(), offer.lead_time_days);

  return (
    <Card 
      className={`
        relative overflow-hidden cursor-pointer transition-all duration-300
        ${isSelected 
          ? 'ring-2 ring-slate-900 shadow-xl scale-[1.02]' 
          : 'border border-slate-200 hover:shadow-lg hover:border-slate-300'
        }
      `}
      onClick={onSelect}
    >
      {/* Type badge */}
      <div className={`absolute top-0 right-0 bg-gradient-to-l ${style.gradient} text-white px-4 py-1.5 rounded-bl-xl`}>
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-semibold">{style.label}</span>
        </div>
      </div>

      <CardContent className="p-6 pt-12">
        {/* Atelier info */}
        <div className="mb-6">
          <p className="text-sm text-slate-500 mb-1">Atelier</p>
          <p className="font-semibold text-slate-900">{offer.atelier_name}</p>
          <p className="text-xs text-slate-400">{offer.atelier_city}</p>
        </div>

        {/* Price */}
        <div className="mb-6">
          <p className="text-sm text-slate-500 mb-1">Preț total</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {offer.total_price.toLocaleString('ro-RO')}
            </span>
            <span className="text-lg text-slate-500">RON</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {(offer.total_price / quantity).toFixed(2)} RON / buc
          </p>
          {offer.setup_fee > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              Include setup: {offer.setup_fee} RON
            </p>
          )}
        </div>

        {/* Lead time */}
        <div className={`rounded-xl p-4 ${style.bgLight} ${style.border} border mb-6`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center`}>
              <Clock className={`w-5 h-5 ${style.text}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${style.text}`}>
                {offer.lead_time_days} zile lucrătoare
              </p>
              <p className="text-xs text-slate-600">
                Livrare estimată: {format(deliveryDate, 'd MMM yyyy', { locale: ro })}
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-2.5 mb-6">
          {offer.features?.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Select button */}
        <Button 
          className={`w-full h-12 font-semibold transition-all ${
            isSelected 
              ? 'bg-slate-900 text-white' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Ofertă selectată
            </>
          ) : (
            'Selectează oferta'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}