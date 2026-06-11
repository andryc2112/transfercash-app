import React, { useState, useRef, useEffect } from 'react';
import { Image, Download, Sliders } from 'lucide-react';

interface TasaTexto {
  id: string;
  label: string;
  valor: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface GeneradorPlantillaProps {
  isAdmin?: boolean;
}

export const GeneradorPlantilla: React.FC<GeneradorPlantillaProps> = ({
  isAdmin = true
}) => {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateUrl, setTemplateUrl] = useState<string>('');
  
  // Tasas a pintar con posiciones X, Y configurables
  const [textos, setTextos] = useState<TasaTexto[]>([
    { id: 'VE', label: 'Tasa Venezuela 🇻🇪', valor: '38.20 Bs', x: 250, y: 150, fontSize: 32, color: '#ffffff' },
    { id: 'CO', label: 'Tasa Colombia 🇨🇴', valor: '4,100 COP', x: 250, y: 220, fontSize: 32, color: '#ffffff' },
    { id: 'PE', label: 'Tasa Perú 🇵🇪', valor: '3.85 PEN', x: 250, y: 290, fontSize: 32, color: '#ffffff' },
    { id: 'CL', label: 'Tasa Chile 🇨🇱', valor: '960 CLP', x: 250, y: 360, fontSize: 32, color: '#ffffff' },
    { id: 'AR', label: 'Tasa Argentina 🇦🇷', valor: '1,200 ARS', x: 250, y: 430, fontSize: 32, color: '#ffffff' },
  ]);

  const [selectedTextoId, setSelectedTextoId] = useState<string>('VE');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados de Logotipo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoConfig, setLogoConfig] = useState({
    x: 50,
    y: 50,
    scale: 0.15,
    visible: true
  });

  // Estado de envio a Telegram
  const [enviandoTelegram, setEnviandoTelegram] = useState(false);

  const activeTexto = textos.find(t => t.id === selectedTextoId) || textos[0];

  // Cargar plantilla por defecto (un rectángulo degradado oscuro simulando un banner)
  useEffect(() => {
    if (!templateFile) {
      // Crear un placeholder degradado como plantilla por defecto
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 600);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 600);
        
        // Bordes y textos decorativos
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, 600, 600);

        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('TASAS DE HOY', 50, 80);

        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.fillText('TransferCash - Publicación Diaria', 50, 110);
        
        setTemplateUrl(canvas.toDataURL());
      }
    }
  }, [templateFile]);

  // Dibujar plantilla y textos en el canvas
  useEffect(() => {
    dibujarCanvas();
  }, [templateUrl, textos, logoUrl, logoConfig]);

  const dibujarLogoPorDefecto = (ctx: CanvasRenderingContext2D, lx: number, ly: number, lscale: number) => {
    ctx.save();
    // Ajustar escala. Por defecto, lscale 1.0 es un logo grande.
    ctx.translate(lx, ly);
    ctx.scale(lscale * 5, lscale * 5); // Multiplicador para rango intuitivo en la UI

    // Dibujar círculo/moneda degradada
    const circleGrad = ctx.createLinearGradient(-15, -15, 15, 15);
    circleGrad.addColorStop(0, '#6366f1'); // Indigo
    circleGrad.addColorStop(1, '#4f46e5');
    
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = circleGrad;
    ctx.fill();

    // Borde blanco fino
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Texto interior "TC"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TC', 0, 0.5);

    // Texto de la marca "TransferCash" al lado
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('TransferCash', 24, 0.5);

    ctx.restore();
  };

  const dibujarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.src = templateUrl;
    img.onload = () => {
      // Ajustar dimensiones del canvas a las de la imagen plantilla
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Renderizar logo si es visible
      if (logoConfig.visible) {
        if (logoUrl) {
          const logoImg = new window.Image();
          logoImg.src = logoUrl;
          logoImg.onload = () => {
            const logoW = logoImg.width * logoConfig.scale;
            const logoH = logoImg.height * logoConfig.scale;
            ctx.drawImage(logoImg, logoConfig.x, logoConfig.y, logoW, logoH);
            
            // Dibujar los textos
            textos.forEach(t => {
              ctx.fillStyle = t.color;
              ctx.font = `bold ${t.fontSize}px sans-serif`;
              ctx.fillText(t.valor, t.x, t.y);
            });
          };
        } else {
          // Dibujar logotipo vectorial por defecto
          dibujarLogoPorDefecto(ctx, logoConfig.x, logoConfig.y, logoConfig.scale);
          
          // Dibujar los textos
          textos.forEach(t => {
            ctx.fillStyle = t.color;
            ctx.font = `bold ${t.fontSize}px sans-serif`;
            ctx.fillText(t.valor, t.x, t.y);
          });
        }
      } else {
        // Dibujar los textos directamente
        textos.forEach(t => {
          ctx.fillStyle = t.color;
          ctx.font = `bold ${t.fontSize}px sans-serif`;
          ctx.fillText(t.valor, t.x, t.y);
        });
      }
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTemplateFile(file);
      const url = URL.createObjectURL(file);
      setTemplateUrl(url);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
    }
  };

  const handleLogoConfigChange = (field: keyof typeof logoConfig, value: any) => {
    setLogoConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTextoConfigChange = (field: keyof TasaTexto, value: any) => {
    setTextos(textos.map(t => {
      if (t.id === selectedTextoId) {
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  const descargarImagen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Tasas_Diarias_${new Date().toISOString().split('T')[0]}.png`;
    link.href = url;
    link.click();
  };


  const compartirWhatsApp = () => {
    // Generar un resumen pre-formateado de las tasas para compartir
    const header = `*💵 TRANSFERCASH - TASAS DE CAMBIO DIARIAS 💵*\n_Fecha: ${new Date().toLocaleDateString()}_\n\n`;
    const body = textos.map(t => `${t.label}: *${t.valor}*`).join('\n');
    const footer = `\n\n📢 _¡Envía tus remesas de forma rápida y segura con TransferCash!_`;
    
    const text = encodeURIComponent(header + body + footer);
    const url = `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const enviarTelegram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setEnviandoTelegram(true);

    canvas.toBlob((blob) => {
      if (!blob) {
        setEnviandoTelegram(false);
        alert('Error al generar la imagen para Telegram');
        return;
      }

      // Preparar el caption
      const header = `*💵 TRANSFERCASH - TASAS DE CAMBIO DIARIAS 💵*\n_Fecha: ${new Date().toLocaleDateString()}_\n\n`;
      const body = textos.map(t => `${t.label}: *${t.valor}*`).join('\n');
      const footer = `\n\n📢 _¡Envía tus remesas de forma rápida y segura con TransferCash!_`;
      const caption = header + body + footer;

      const formData = new FormData();
      formData.append('chat_id', '-5201919939');
      formData.append('photo', blob, 'tasas_diarias.png');
      formData.append('caption', caption);
      formData.append('parse_mode', 'Markdown');

      fetch('https://api.telegram.org/bot8576377601:AAFlnEF38oYA2i1RmwAMGIHY6slsVIvat8c/sendPhoto', {
        method: 'POST',
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('La llamada a la API de Telegram falló');
          }
          return response.json();
        })
        .then(() => {
          alert('¡Imagen de tasas enviada exitosamente al grupo de Telegram!');
        })
        .catch((error) => {
          console.error(error);
          alert('Error al enviar la imagen a Telegram: ' + error.message);
        })
        .finally(() => {
          setEnviandoTelegram(false);
        });
    }, 'image/png');
  };


  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Editor visual y Configuración (Solo Admin) */}
      {isAdmin && (
        <div className="md:col-span-1 space-y-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Configurar Plantilla</h3>
          </div>

          {/* Subir archivo */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase block">Subir Plantilla Gráfica (.png / .jpg)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100/70 transition">
                <div className="flex flex-col items-center justify-center pt-3 pb-3">
                  <Image className="w-6 h-6 text-slate-400 mb-1" />
                  <p className="text-[10px] text-slate-500 font-semibold">Haz clic para subir archivo</p>
                </div>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          </div>

          {/* Subir Logotipo */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase block">Subir Logotipo (.png transparente)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100/70 transition">
                <div className="flex flex-col items-center justify-center pt-3 pb-3">
                  <Image className="w-6 h-6 text-indigo-400 mb-1" />
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {logoFile ? logoFile.name : 'Haz clic para subir logo'}
                  </p>
                </div>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
            </div>
          </div>

          {/* Seleccionar País/Tasa */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase block">Seleccionar Tasa a Editar</label>
            <select
              value={selectedTextoId}
              onChange={(e) => setSelectedTextoId(e.target.value)}
              className="w-full bg-slate-50 rounded-lg border border-slate-200 p-2 text-xs font-bold focus:outline-none"
            >
              {textos.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Controles de Posición y Estilo */}
          <div className="space-y-3 pt-2 border-t text-xs space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-slate-600">
                <span>Valor de la Tasa:</span>
              </div>
              <input
                type="text"
                value={activeTexto.valor}
                onChange={(e) => handleTextoConfigChange('valor', e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="font-bold text-slate-600">Posición X (px):</span>
                <input
                  type="number"
                  value={activeTexto.x}
                  onChange={(e) => handleTextoConfigChange('x', parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-bold text-center"
                />
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-600">Posición Y (px):</span>
                <input
                  type="number"
                  value={activeTexto.y}
                  onChange={(e) => handleTextoConfigChange('y', parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-bold text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="font-bold text-slate-600">Tamaño Fuente:</span>
                <input
                  type="number"
                  value={activeTexto.fontSize}
                  onChange={(e) => handleTextoConfigChange('fontSize', parseInt(e.target.value) || 12)}
                  className="w-full rounded-lg border border-slate-200 p-2 font-bold text-center"
                />
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-600">Color Texto:</span>
                <input
                  type="color"
                  value={activeTexto.color}
                  onChange={(e) => handleTextoConfigChange('color', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 h-9 p-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Configuración de Logotipo */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-3">
            <div className="flex justify-between items-center border-b pb-1">
              <span className="font-extrabold text-slate-700 uppercase text-[10px]">Ajustes de Logotipo</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={logoConfig.visible}
                  onChange={(e) => handleLogoConfigChange('visible', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                <span className="text-[10px] text-slate-500 font-bold uppercase">Mostrar</span>
              </label>
            </div>

            {logoConfig.visible && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-600">Logo X (px):</span>
                    <input
                      type="number"
                      value={logoConfig.x}
                      onChange={(e) => handleLogoConfigChange('x', parseInt(e.target.value) || 0)}
                      className="w-full bg-white rounded-lg border border-slate-200 p-2 font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-600">Logo Y (px):</span>
                    <input
                      type="number"
                      value={logoConfig.y}
                      onChange={(e) => handleLogoConfigChange('y', parseInt(e.target.value) || 0)}
                      className="w-full bg-white rounded-lg border border-slate-200 p-2 font-bold text-center"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>Tamaño / Escala:</span>
                    <span>{(logoConfig.scale * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.5"
                    step="0.05"
                    value={logoConfig.scale}
                    onChange={(e) => handleLogoConfigChange('scale', parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Preview del Canvas */}
      <div className={isAdmin ? "md:col-span-2 space-y-4" : "md:col-span-3 space-y-4"}>
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between">
            <h2 className="font-bold text-base">Vista Previa de Imagen</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={compartirWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-md shadow-emerald-600/10"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.286c1.656.982 3.535 1.5 5.462 1.501 5.486 0 9.95-4.46 9.954-9.943.002-2.657-1.01-5.155-2.85-6.997-1.84-1.841-4.288-2.855-6.953-2.856-5.486 0-9.952 4.46-9.956 9.944-.001 2.01.524 3.974 1.52 5.71L2.9 21.097l4.032-1.058l-.085-.133zm11.39-7.21c-.3-.15-1.77-.874-2.043-.974-.272-.1-.472-.15-.67.15-.2.3-.77.974-.943 1.173-.173.2-.347.225-.648.075-.3-.15-1.266-.467-2.41-1.487-.89-.793-1.49-1.77-1.665-2.07-.173-.3-.018-.462.13-.61.137-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.67-1.62-.92-2.2-.24-.575-.48-.5-.67-.51-.172-.008-.37-.01-.567-.01-.2 0-.52.075-.79.375-.27.3-1.03 1.007-1.03 2.456 0 1.45 1.05 2.85 1.2 3.05.15.2 2.07 3.162 5.016 4.434.7.3 1.25.48 1.677.616.704.224 1.344.193 1.85.118.563-.083 1.77-.723 2.02-1.388.25-.664.25-1.233.175-1.388-.075-.15-.275-.25-.575-.4z" />
                </svg>
                WhatsApp
              </button>
              
              <button
                onClick={enviarTelegram}
                disabled={enviandoTelegram}
                className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-md shadow-sky-500/10 cursor-pointer"
              >
                {enviandoTelegram ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
                  </svg>
                )}
                {enviandoTelegram ? 'Enviando...' : 'Telegram'}
              </button>

              <button
                onClick={descargarImagen}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow-md shadow-indigo-600/10"
              >
                <Download className="w-3.5 h-3.5" /> Descargar PNG
              </button>
            </div>
          </div>
          <div className="p-6 bg-slate-100 flex justify-center items-center overflow-auto max-h-[60vh] scrollbar-none">
            <canvas
              ref={canvasRef}
              className="border border-slate-300 shadow-lg rounded-xl max-w-full h-auto bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
