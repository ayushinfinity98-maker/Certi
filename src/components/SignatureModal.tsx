import React, { useRef, useState, useEffect } from 'react';
import { CampusAmbassador } from '../types';
import { generateScriptSignatureDataUrl, processSignatureImageFile } from '../utils/signatureUtils';
import { Upload, Edit3, Type, Check, X, Trash2, Shield } from 'lucide-react';

interface SignatureModalProps {
  ca: CampusAmbassador;
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => Promise<void>;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  ca,
  isOpen,
  onClose,
  onSave
}) => {
  const [tab, setTab] = useState<'upload' | 'draw' | 'type'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>(ca.signatureUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState(ca.name);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setPreviewUrl(ca.signatureUrl || '');
    setTypedName(ca.name);
  }, [ca]);

  // Setup drawing canvas
  useEffect(() => {
    if (tab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [tab]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processSignatureImageFile(file);
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error('Failed reading signature file:', err);
    }
  };

  // Drawing canvas events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setPreviewUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setPreviewUrl('');
    }
  };

  const handleGenerateTyped = () => {
    const url = generateScriptSignatureDataUrl(typedName || ca.name);
    setPreviewUrl(url);
  };

  const handleSave = async () => {
    if (!previewUrl) return;
    setIsSaving(true);
    try {
      await onSave(previewUrl);
      onClose();
    } catch (err) {
      console.error('Error saving signature:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Shield className="w-5 h-5 text-blue-600 mr-2" />
              Manage E-Signature
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Assigned to: <span className="font-semibold text-gray-700">{ca.name}</span> ({ca.caId})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex space-x-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
              tab === 'upload' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Image</span>
          </button>
          <button
            onClick={() => setTab('draw')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
              tab === 'draw' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Digital Pad</span>
          </button>
          <button
            onClick={() => setTab('type')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
              tab === 'type' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Cursive Script</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[180px] flex flex-col justify-center">
          {tab === 'upload' && (
            <div className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl p-6 text-center transition flex flex-col items-center justify-center space-y-2 bg-gray-50/50">
              <Upload className="w-8 h-8 text-blue-500 mb-1" />
              <label className="cursor-pointer px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-50 transition shadow-xs">
                Select Signature Image (PNG / JPEG)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <p className="text-[11px] text-gray-400">
                Transparent PNG recommended. Maximum 2MB.
              </p>
            </div>
          )}

          {tab === 'draw' && (
            <div className="flex flex-col space-y-2">
              <div className="border border-gray-300 rounded-xl bg-slate-50 overflow-hidden relative">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="w-full h-[150px] cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-md text-xs text-red-600 hover:bg-white shadow-xs flex items-center border border-gray-200"
                  title="Clear pad"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                </button>
              </div>
              <p className="text-[11px] text-gray-500 text-center">
                Draw signature smoothly using your cursor or touchscreen
              </p>
            </div>
          )}

          {tab === 'type' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ambassador Name
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    placeholder="e.g. Alex Chen"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateTyped}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Container */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Signature Preview on Certificate
          </span>
          <div className="h-20 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-2 relative overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Signature preview"
                className="max-h-16 max-w-full object-contain"
              />
            ) : (
              <span className="text-xs italic text-gray-400">
                No signature configured yet
              </span>
            )}
            <div className="absolute bottom-1 left-4 right-4 border-b border-gray-300/80 pointer-events-none" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!previewUrl || isSaving}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center"
          >
            <Check className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving Signature...' : 'Save & Assign Signature'}
          </button>
        </div>

      </div>
    </div>
  );
};
