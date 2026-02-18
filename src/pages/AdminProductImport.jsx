import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";

const CSV_TEMPLATE = `name,category,subcategory,base_cost,manufacturing_cost,default_lead_time_days,min_qty,available_colors,available_sizes,personalization_options,description
Tricou Basic,tricouri,casual,25,15,5,10,"Alb,Negru,Navy,Gri","S,M,L,XL,XXL","print_dtg,print_screen,broderie",Tricou 100% bumbac
Hanorac Classic,hanorace,casual,75,45,7,20,"Negru,Navy,Gri","S,M,L,XL,XXL","print_dtg,broderie,patch",Hanorac cu glugă`;

export default function AdminProductImportPage() {
  const queryClient = useQueryClient();
  const [csvData, setCsvData] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [error, setError] = useState('');

  const importMutation = useMutation({
    mutationFn: async (products) => {
      return base44.entities.ProductTemplate.bulkCreate(products);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['products']);
      toast.success(`${result.length} produse importate cu succes`);
      setCsvData('');
      setPreviewData([]);
    },
    onError: (err) => {
      toast.error('Eroare la import');
      setError(err.message);
    }
  });

  const parseCSV = () => {
    try {
      setError('');
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        setError('CSV invalid - minim 2 linii (header + 1 produs)');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const products = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const product = {};

        headers.forEach((header, idx) => {
          const value = values[idx];
          
          if (['base_cost', 'manufacturing_cost', 'default_lead_time_days', 'min_qty'].includes(header)) {
            product[header] = parseFloat(value) || 0;
          } else if (['available_colors', 'available_sizes', 'personalization_options'].includes(header)) {
            product[header] = value ? value.split(';').map(v => v.trim()) : [];
          } else {
            product[header] = value;
          }
        });

        product.is_active = true;
        products.push(product);
      }

      setPreviewData(products);
    } catch (err) {
      setError('Eroare la parsare CSV: ' + err.message);
    }
  };

  const handleImport = () => {
    if (previewData.length === 0) {
      setError('Nu există date de importat');
      return;
    }
    importMutation.mutate(previewData);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_produse.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Import Bulk Produse</h1>
          <p className="text-slate-600">Importă multiple produse dintr-un fișier CSV</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Date CSV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Lipește aici datele CSV..."
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button onClick={parseCSV} disabled={!csvData} className="flex-1">
                    Previzualizează
                  </Button>
                  <Button onClick={downloadTemplate} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            {previewData.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Previzualizare ({previewData.length} produse)</span>
                    <Button onClick={handleImport} disabled={importMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Importă
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {previewData.map((product, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                        <div className="font-semibold text-slate-900">{product.name}</div>
                        <div className="text-sm text-slate-600">
                          {product.category} • {product.base_cost} RON • {product.min_qty} min
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Format CSV</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2">
                  <p className="font-semibold">Coloane obligatorii:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>name</li>
                    <li>category</li>
                    <li>base_cost</li>
                  </ul>

                  <p className="font-semibold mt-4">Categorii valide:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>tricouri</li>
                    <li>hanorace</li>
                    <li>polo</li>
                    <li>geci</li>
                    <li>accesorii</li>
                  </ul>

                  <p className="font-semibold mt-4">Note:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs">
                    <li>Valori multiple separate cu ;</li>
                    <li>Ex: "S;M;L;XL"</li>
                    <li>Nu folosi virgule în valori</li>
                    <li>Prima linie = header</li>
                  </ul>
                </div>

                <Button variant="outline" className="w-full" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Descarcă Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}