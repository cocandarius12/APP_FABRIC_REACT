import React from 'react';
import { Check, Clock, Package, Truck, CheckCircle, XCircle } from "lucide-react";
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const statusSteps = [
  { key: 'accepted', label: 'Confirmat', icon: Check },
  { key: 'in_production', label: 'În producție', icon: Package },
  { key: 'qa', label: 'Control calitate', icon: CheckCircle },
  { key: 'ready_for_shipping', label: 'Gata de expediere', icon: Package },
  { key: 'shipped', label: 'Expediat', icon: Truck },
  { key: 'delivered', label: 'Livrat', icon: CheckCircle }
];

const statusOrder = ['draft', 'offer_sent', 'accepted', 'in_production', 'qa', 'ready_for_shipping', 'shipped', 'delivered', 'closed'];

export default function OrderStatusTracker({ order }) {
  const currentIndex = statusOrder.indexOf(order.status);
  
  if (order.status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
        <XCircle className="w-6 h-6 text-red-500" />
        <div>
          <p className="font-semibold text-red-700">Comandă anulată</p>
          <p className="text-sm text-red-600">Această comandă a fost anulată</p>
        </div>
      </div>
    );
  }

  if (currentIndex < 2) {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
        <Clock className="w-6 h-6 text-amber-500" />
        <div>
          <p className="font-semibold text-amber-700">În așteptare</p>
          <p className="text-sm text-amber-600">
            {order.status === 'draft' ? 'Comandă în draft' : 'Ofertă trimisă, așteptăm confirmare'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200" />
        <div 
          className="absolute top-5 left-0 h-0.5 bg-emerald-500 transition-all duration-500"
          style={{ 
            width: `${Math.min(100, ((currentIndex - 2) / (statusSteps.length - 1)) * 100)}%` 
          }}
        />
        
        {statusSteps.map((step, idx) => {
          const stepIndex = statusOrder.indexOf(step.key);
          const isCompleted = currentIndex >= stepIndex;
          const isCurrent = order.status === step.key;
          const Icon = step.icon;
          
          return (
            <div key={step.key} className="relative flex flex-col items-center z-10">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${isCompleted 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-slate-100 text-slate-400'
                }
                ${isCurrent ? 'ring-4 ring-emerald-100 scale-110' : ''}
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <p className={`
                text-xs mt-2 text-center max-w-[80px]
                ${isCompleted ? 'text-slate-900 font-medium' : 'text-slate-400'}
              `}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}