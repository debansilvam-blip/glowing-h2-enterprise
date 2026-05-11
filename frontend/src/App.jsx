import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import html2canvas from "html2canvas";

export default function App() {
  const [capacityMW, setCapacityMW] = useState(50);
  const [capacidadEolicaMW, setCapacidadEolicaMW] = useState(50);
  const [irradianciaSolar, setIrradianciaSolar] = useState(6.0);
  const [velocidadViento, setVelocidadViento] = useState(9.0);
  const [clima, setClima] = useState('normal'); 
  
  const [data, setData] = useState({ produccion_h2: 0, agua: 0, co2: 0, lcoh_verde: 4.50, lcoh_gris: 2.10, compensacion: 0 });
  const [prediccionData, setPrediccionData] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [hoveredText, setHoveredText] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const handleRelease = () => setIsDragging(false);
    window.addEventListener('mouseup', handleRelease);
    window.addEventListener('touchend', handleRelease);
    return () => {
      window.removeEventListener('mouseup', handleRelease);
      window.removeEventListener('touchend', handleRelease);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchDatos = async () => {
      setLoading(true);
      setErrorStatus("");
      
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'https://h2-uribia-api.onrender.com';
        const [resSimulacion, resPrediccion] = await Promise.all([
            fetch(`${API_URL}/simulacion?capacidad_solar_mw=${capacityMW}&capacidad_eolica_mw=${capacidadEolicaMW}&irradiancia_solar=${irradianciaSolar}&velocidad_viento=${velocidadViento}`),
            fetch(`${API_URL}/prediccion?capacidad_solar_mw=${capacityMW}&capacidad_eolica_mw=${capacidadEolicaMW}&irradiancia_solar=${irradianciaSolar}&velocidad_viento=${velocidadViento}`)
        ]);

        if (!resSimulacion.ok) throw new Error("Fetch falló con status " + resSimulacion.status);
        
        const result = await resSimulacion.json();
        let resultPrediccion = { prediccion_24h: [] };
        if (resPrediccion.ok) {
            resultPrediccion = await resPrediccion.json();
        }
        
        if (isMounted) {
          setData({
            produccion_h2: result.resultados_diarios?.produccion_h2_kg ?? 0,
            agua: result.resultados_diarios?.agua_necesaria_litros ?? 0,
            co2: result.resultados_diarios?.co2_evitado_kg ?? 0,
            lcoh_verde: result.economia?.lcoh_verde_usd ?? 4.50,
            lcoh_gris: result.economia?.lcoh_gris_usd ?? 2.10,
            compensacion: result.economia?.compensacion_impuesto_carbono_porcentaje ?? 36.1
          });
          setPrediccionData(resultPrediccion.prediccion_24h || []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorStatus("Backend no detectado. Usando lógica de respaldo local.");
          const energia_diaria_solar_kwh = (capacityMW * 1000) * irradianciaSolar;
          let kw_eolico = 0;
          if (velocidadViento >= 3 && velocidadViento <= 25) {
              const cap_kw = capacidadEolicaMW * 1000;
              kw_eolico = Math.min(cap_kw, cap_kw * Math.pow(velocidadViento / 12.0, 3));
          }
          const energia_diaria_eolica_kwh = kw_eolico * 24;
          const energia_total_kwh = energia_diaria_solar_kwh + energia_diaria_eolica_kwh;
          const produccion_diaria_h2_kg = energia_total_kwh / 52.5;
          
          setData({
            produccion_h2: produccion_diaria_h2_kg,
            agua: produccion_diaria_h2_kg * 9.0,
            co2: produccion_diaria_h2_kg * 3.33 * 2.6,
            lcoh_verde: 4.50,
            lcoh_gris: 2.10,
            compensacion: 36.1
          });

          const fallbackPred = [];
          const cap_solar_kw = capacityMW * 1000;
          const cap_eol_kw = capacidadEolicaMW * 1000;
          for (let i = 0; i < 24; i++) {
              let kw_solar = 0;
              if (i >= 6 && i <= 18) {
                  const x = (i - 6) / 12 * Math.PI;
                  let base = cap_solar_kw * (irradianciaSolar / 6.0) * Math.sin(x);
                  kw_solar = Math.max(0, base + (Math.random() - 0.5) * 0.1 * base);
              }
              
              let kw_hora_eolico = 0;
              if (velocidadViento > 25) {
                  kw_hora_eolico = 0;
              } else {
                  let v_hora = Math.max(0, velocidadViento + (Math.random() - 0.5) * 2);
                  if (v_hora >= 3 && v_hora < 12) {
                      kw_hora_eolico = cap_eol_kw * Math.pow(v_hora / 12.0, 3);
                  } else if (v_hora >= 12) {
                      kw_hora_eolico = cap_eol_kw + (Math.random() - 0.5) * 0.04 * cap_eol_kw;
                  }
                  kw_hora_eolico = Math.max(0, Math.min(cap_eol_kw, kw_hora_eolico));
              }
              
              let prod_solar = kw_solar / 52.5;
              let prod_eolica = kw_hora_eolico / 52.5;
              let h2 = prod_solar + prod_eolica;
              
              fallbackPred.push({ 
                  hora: `${i.toString().padStart(2, '0')}:00`, 
                  solar: Number(prod_solar.toFixed(2)),
                  eolica: Number(prod_eolica.toFixed(2)),
                  h2: Number(h2.toFixed(2)) 
              });
          }
          setPrediccionData(fallbackPred);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDatos();

    return () => { isMounted = false; };
  }, [capacityMW, capacidadEolicaMW, irradianciaSolar, velocidadViento]);

  const handleClimaChange = (nuevoClima) => {
      setClima(nuevoClima);
      if (nuevoClima === 'normal') {
          setIrradianciaSolar(6.0);
          setVelocidadViento(9.0);
      } else if (nuevoClima === 'soleado') {
          setIrradianciaSolar(8.0);
          setVelocidadViento(4.0);
      } else if (nuevoClima === 'nublado') {
          setIrradianciaSolar(2.0);
          setVelocidadViento(12.0);
      } else if (nuevoClima === 'tormenta') {
          setIrradianciaSolar(0.0);
          setVelocidadViento(26.0);
      }
  };
  
  const displayData = {
    produccion_h2: data.produccion_h2,
    agua: data.agua,
    co2: data.co2,
    lcoh_verde: data.lcoh_verde,
    lcoh_gris: data.lcoh_gris,
    compensacion: data.compensacion
  };

  const displayPrediccion = prediccionData.map(p => ({
    ...p,
    solar: Number((p.solar || 0).toFixed(2)),
    eolica: Number((p.eolica || 0).toFixed(2)),
    h2: Number((p.h2 || 0).toFixed(2))
  }));

  const dieselReemplazado = displayData?.produccion_h2 ? (displayData.produccion_h2 * 3.5).toFixed(2) : "0.00";
  const gasReemplazado = displayData?.produccion_h2 ? (displayData.produccion_h2 * 11.2).toFixed(2) : "0.00";
  const gasolinaReemplazada = displayData?.produccion_h2 ? (displayData.produccion_h2 * 3.8).toFixed(2) : "0.00";
  const carbonReemplazado = displayData?.produccion_h2 ? (displayData.produccion_h2 * 4.8).toFixed(2) : "0.00";

  const maxAxisValue = Math.ceil(((capacityMW + capacidadEolicaMW) * 1000) / 52.5 * 1.05);

  // DEFINICIÓN DE TEMAS DINÁMICOS
  const THEMES = {
    normal: {
      bgFrom: '#0f172a',
      bgTo: '#1e293b',
      accent: '#10b981',
      secondary: '#3b82f6',
      radialPos: '0% 0%'
    },
    soleado: {
      bgFrom: '#075985',
      bgTo: '#f59e0b',
      accent: '#fbbf24',
      secondary: '#ea580c',
      radialPos: '100% 0%'
    },
    nublado: {
      bgFrom: '#334155',
      bgTo: '#475569',
      accent: '#38bdf8',
      secondary: '#64748b',
      radialPos: '50% 50%'
    },
    tormenta: {
      bgFrom: '#1e1b4b',
      bgTo: '#7f1d1d',
      accent: '#e11d48',
      secondary: '#f97316',
      radialPos: '50% 100%'
    }
  };

  const activeTheme = THEMES[clima] || THEMES['normal'];

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
        const pdf = new jsPDF('portrait', 'mm', 'a4');
        
        const primaryColor = [15, 23, 42]; 
        
        // Encabezado Institucional
        pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.rect(0, 0, 210, 35, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text("REPORTE DE SIMULACIÓN - MICRO-RED H2 URIBIA", 105, 15, { align: "center" });
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Fecha: ${new Date().toLocaleString()}`, 105, 23, { align: "center" });
        pdf.text("Coordenadas: 11.7144° N, 72.2658° W (La Guajira, Colombia)", 105, 29, { align: "center" });

        let currentY = 45;

        // Tabla 1: Parámetros de Diseño
        autoTable(pdf, {
            startY: currentY,
            head: [['Parámetros de Diseño', 'Valor']],
            body: [
                ['Capacidad Solar Instalada', `${capacityMW} MW`],
                ['Capacidad Eólica Instalada', `${capacidadEolicaMW} MW`],
                ['Irradiancia Solar Promedio', `${irradianciaSolar.toFixed(1)} kWh/m²/día`],
                ['Velocidad del Viento', `${velocidadViento.toFixed(1)} m/s`],
                ['Escenario Climático', clima.toUpperCase()]
            ],
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            bodyStyles: { textColor: 50 },
            alternateRowStyles: { fillColor: [241, 245, 249] }
        });
        
        currentY = pdf.lastAutoTable.finalY + 10;

        // Tabla 2: Resultados Operativos
        autoTable(pdf, {
            startY: currentY,
            head: [['Resultados Operativos (Diarios)', 'Valor']],
            body: [
                ['Producción de Hidrógeno', `${displayData?.produccion_h2?.toFixed(2)} kg/día`],
                ['Consumo Hídrico Estimado', `${displayData?.agua?.toFixed(2)} L/día`],
                ['Mitigación de Carbono (CO2)', `${displayData?.co2?.toFixed(2)} kg/día`],
                ['Diésel Equivalente Reemplazado', `${dieselReemplazado} kg/día`],
                ['Gas Natural Equivalente Reemplazado', `${gasReemplazado} m³/día`]
            ],
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            bodyStyles: { textColor: 50 },
            alternateRowStyles: { fillColor: [241, 245, 249] }
        });

        currentY = pdf.lastAutoTable.finalY + 10;

        // Tabla 3: Viabilidad Económica
        autoTable(pdf, {
            startY: currentY,
            head: [['Viabilidad Económica', 'Valor']],
            body: [
                ['LCOH H2 Verde (Producido)', `$${displayData?.lcoh_verde?.toFixed(2)} USD/kg`],
                ['LCOH H2 Gris (Mercado)', `$${displayData?.lcoh_gris?.toFixed(2)} USD/kg`],
                ['Compensación por Impuesto al Carbono', `${displayData?.compensacion?.toFixed(1)}%`]
            ],
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            bodyStyles: { textColor: 50 },
            alternateRowStyles: { fillColor: [241, 245, 249] }
        });

        currentY = pdf.lastAutoTable.finalY + 15;

        // Título de la gráfica
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Análisis Predictivo 24H (Red LSTM)", 14, currentY);
        currentY += 5;

        // Capturar gráfica con html2canvas
        const graphElement = document.getElementById('grafica-24h');
        if (graphElement) {
            const canvas = await html2canvas(graphElement, {
                backgroundColor: activeTheme.bgFrom,
                scale: 2, 
                useCORS: true,
                logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            
            const margin = 14;
            const pdfWidth = 210 - (margin * 2);
            const imgProps = pdf.getImageProperties(imgData);
            const imgRatio = imgProps.width / imgProps.height;
            const finalHeight = pdfWidth / imgRatio;

            if (currentY + finalHeight > 297 - 20) {
                pdf.addPage();
                currentY = 20;
            }

            pdf.addImage(imgData, 'PNG', margin, currentY, pdfWidth, finalHeight);
        }

        pdf.save(`Reporte_Tecnico_H2_${capacityMW}MW_${clima}.pdf`);
    } catch (error) {
        console.error("Error al generar PDF estructurado:", error);
    } finally {
        setIsGeneratingPDF(false);
    }
  };

  return (
    <div style={{ 
        minHeight: '100vh', 
        height: 'auto',
        fontFamily: "'Inter', sans-serif", 
        background: `radial-gradient(circle at ${activeTheme.radialPos}, ${activeTheme.bgFrom} 0%, ${activeTheme.bgTo} 100%)`, 
        color: '#f8fafc', 
        padding: '2rem 5% 5rem 5%', 
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '2.5rem',
        transition: 'background 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
        
        * {
            transition: color 1.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 1.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glass-card {
          background: rgba(30, 41, 59, 0.5);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          padding: 2rem;
          transition: transform 0.3s ease, border-color 1.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
        }
        .glass-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
        }

        .dynamic-gradient-text {
          background: linear-gradient(to right, ${activeTheme.accent}, ${activeTheme.secondary});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .number-stat {
          font-size: 3.5rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          margin: 0.5rem 0;
          line-height: 1.1;
          transition: all 0.3s ease;
        }

        .pill-btn {
          padding: 0.7rem 1.8rem;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: rgba(255, 255, 255, 0.03);
          color: #94a3b8;
        }
        .pill-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          transform: translateY(-2px);
        }
        .pill-btn.active {
          background: linear-gradient(to right, ${activeTheme.accent}, ${activeTheme.secondary});
          color: #fff;
          border: none;
          box-shadow: 0 8px 20px ${activeTheme.accent}40;
        }

        /* Custom Range Slider */
        input[type=range] {
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: ${activeTheme.accent};
          cursor: pointer;
          margin-top: -10px;
          box-shadow: 0 0 15px ${activeTheme.accent}80;
          transition: transform 0.1s, background 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
        }
        
        @keyframes pulseAlert {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
      
      {/* HEADER ENTERPRISE (STICKY) */}
      <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '2rem',
          position: 'sticky',
          top: '0',
          zIndex: 50,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '1.5rem',
          margin: '-2rem -1.5rem 0 -1.5rem',
          borderRadius: '0 0 20px 20px',
          borderBottom: `1px solid ${activeTheme.accent}30`,
          boxShadow: `0 10px 30px -10px ${activeTheme.bgFrom}`
      }}>
        <div>
            <h1 className="dynamic-gradient-text" style={{ letterSpacing: '-0.02em', margin: '0 0 0.5rem 0', fontSize: '2.5rem', fontWeight: 800 }}>
                H2 ENTERPRISE PLATFORM
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem', fontWeight: 400 }}>Planta Descentralizada - Uribia, La Guajira</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div 
                style={{ width: '220px', background: 'rgba(255,255,255,0.02)', padding: '1rem 1.5rem', borderRadius: '16px', border: `1px solid ${activeTheme.accent}20` }}
                onMouseEnter={() => setHoveredText("Ajusta el área total de captación fotovoltaica. Influye únicamente en el pico de producción diurno (06:00 - 18:00).")}
                onMouseLeave={() => setHoveredText(null)}
            >
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1' }}>
                    <span>Cap. Solar:</span> <span className="dynamic-gradient-text" style={{ fontWeight: 800 }}>{capacityMW} MW</span>
                </label>
                <input 
                    type="range" 
                    min="1" max="200" 
                    value={capacityMW} 
                    onChange={(e) => setCapacityMW(Number(e.target.value))} 
                    onMouseDown={() => setIsDragging(true)}
                    onTouchStart={() => setIsDragging(true)}
                />
            </div>
            
            <div 
                style={{ width: '220px', background: 'rgba(255,255,255,0.02)', padding: '1rem 1.5rem', borderRadius: '16px', border: `1px solid ${activeTheme.secondary}20` }}
                onMouseEnter={() => setHoveredText("Establece la capacidad nominal de los aerogeneradores. Es la base de carga constante del sistema en Uribia.")}
                onMouseLeave={() => setHoveredText(null)}
            >
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1' }}>
                    <span>Cap. Eólica:</span> <span style={{ fontWeight: 800, color: activeTheme.secondary }}>{capacidadEolicaMW} MW</span>
                </label>
                <input 
                    type="range" 
                    min="1" max="200" 
                    value={capacidadEolicaMW} 
                    onChange={(e) => setCapacidadEolicaMW(Number(e.target.value))} 
                    onMouseDown={() => setIsDragging(true)}
                    onTouchStart={() => setIsDragging(true)}
                />
            </div>

            <div 
                style={{ width: '220px', background: 'rgba(255,255,255,0.02)', padding: '1rem 1.5rem', borderRadius: '16px', border: `1px solid ${activeTheme.secondary}20` }}
                onMouseEnter={() => setHoveredText("Variable climática crítica. La potencia generada es proporcional al cubo de la velocidad (v³). Pequeños cambios aquí alteran drásticamente la curva azul.")}
                onMouseLeave={() => setHoveredText(null)}
            >
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1' }}>
                    <span>Velocidad del Viento:</span> <span style={{ fontWeight: 800, color: activeTheme.secondary }}>{velocidadViento} m/s</span>
                </label>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right', marginTop: '-10px', marginBottom: '5px' }}>
                    {(velocidadViento * 1.94384).toFixed(1)} nudos
                </div>
                <input 
                    type="range" 
                    min="0" max="30" step="0.5"
                    value={velocidadViento} 
                    onChange={(e) => setVelocidadViento(Number(e.target.value))} 
                    onMouseDown={() => setIsDragging(true)}
                    onTouchStart={() => setIsDragging(true)}
                />
            </div>
            
            <button 
                onClick={handleDownloadPDF} 
                disabled={isGeneratingPDF}
                style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: `1px solid ${activeTheme.accent}50`,
                    color: '#f8fafc',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    cursor: isGeneratingPDF ? 'wait' : 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    opacity: isGeneratingPDF ? 0.7 : 1,
                    boxShadow: `0 4px 15px ${activeTheme.accent}20`
                }}
            >
                {isGeneratingPDF ? '⏳ Procesando Data...' : '⬇️ Descargar Reporte PDF'}
            </button>
        </div>
      </div>

      {errorStatus && (
        <div style={{ padding: '1rem 1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5', fontWeight: 600 }}>
          ⚠️ {errorStatus}
        </div>
      )}

      <div id="reporte-contenido" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '2.5rem',
          opacity: loading ? 0.6 : 1,
          transition: 'opacity 0.3s ease',
          pointerEvents: loading ? 'none' : 'auto'
      }}>
            {/* ESCENARIOS CLIMÁTICOS */}
            <div className="glass-card" data-html2canvas-ignore style={{ border: `1px solid ${activeTheme.accent}40`, padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', ...(clima === 'tormenta' ? { animation: 'pulseAlert 2s infinite' } : {}) }}>
                <h3 style={{ color: activeTheme.accent, margin: '0', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 700 }}>
                    Modelado de Condiciones
                </h3>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button 
                        className={`pill-btn ${clima === 'normal' ? 'active' : ''}`} 
                        onClick={() => handleClimaChange('normal')}
                        onMouseEnter={() => setHoveredText("Simula los vientos alisios constantes y cielos despejados típicos de La Guajira.")}
                        onMouseLeave={() => setHoveredText(null)}
                    >
                        Normal (Alisios)
                    </button>
                    <button 
                        className={`pill-btn ${clima === 'soleado' ? 'active' : ''}`} 
                        onClick={() => handleClimaChange('soleado')}
                        onMouseEnter={() => setHoveredText("Maximiza la solar, pero simula un estancamiento eólico (vientos en calma).")}
                        onMouseLeave={() => setHoveredText(null)}
                    >
                        ☀️ Alta Irradiancia / Viento Calmo
                    </button>
                    <button 
                        className={`pill-btn ${clima === 'nublado' ? 'active' : ''}`} 
                        onClick={() => handleClimaChange('nublado')}
                        onMouseEnter={() => setHoveredText("Escenario de cielos cubiertos donde el recurso eólico fuerte compensa la caída de la producción solar.")}
                        onMouseLeave={() => setHoveredText(null)}
                    >
                        ☁️ Baja Radiación / Viento Fuerte
                    </button>
                    <button 
                        className={`pill-btn danger ${clima === 'tormenta' ? 'active' : ''}`} 
                        onClick={() => handleClimaChange('tormenta')}
                        onMouseEnter={() => setHoveredText("Protocolo de seguridad: Se activa el frenado de turbinas (cut-out) por exceso de velocidad y la radiación cae a cero.")}
                        onMouseLeave={() => setHoveredText(null)}
                    >
                        ⛈️ Tormenta Tropical (Seguridad)
                    </button>
                </div>
            </div>

            {/* TARJETAS PRINCIPALES (METRICAS) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <div className="glass-card" style={{ border: `1px solid ${activeTheme.accent}30`, borderTop: `4px solid ${activeTheme.accent}` }}>
                    <h3 style={{ margin: '0', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 600 }}>Volumen de Producción (H2)</h3>
                    <p className="number-stat" style={{ color: clima === 'tormenta' ? activeTheme.accent : '#fff' }}>
                        {displayData?.produccion_h2?.toFixed(2) || "0.00"} <span style={{fontSize: '1.2rem', color: '#64748b', fontWeight: 600, letterSpacing: 'normal'}}>kg/día</span>
                    </p>
                </div>

                <div className="glass-card" style={{ border: `1px solid ${activeTheme.accent}30`, borderTop: `4px solid ${activeTheme.secondary}` }}>
                    <h3 style={{ margin: '0', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 600 }}>Consumo Hídrico Estimado</h3>
                    <p className="number-stat" style={{ color: clima === 'tormenta' ? activeTheme.accent : '#fff' }}>
                        {displayData?.agua?.toFixed(2) || "0.00"} <span style={{fontSize: '1.2rem', color: '#64748b', fontWeight: 600, letterSpacing: 'normal'}}>L/día</span>
                    </p>
                </div>

                <div className="glass-card" style={{ border: `1px solid ${activeTheme.accent}30`, borderTop: `4px solid ${activeTheme.accent}` }}>
                    <h3 style={{ margin: '0', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 600 }}>Mitigación de Carbono (CO2)</h3>
                    <p className="number-stat" style={{ color: clima === 'tormenta' ? activeTheme.accent : '#fff' }}>
                        {displayData?.co2?.toFixed(2) || "0.00"} <span style={{fontSize: '1.2rem', color: '#64748b', fontWeight: 600, letterSpacing: 'normal'}}>kg/día</span>
                    </p>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: `1px solid ${activeTheme.accent}30` }} onClick={() => setIsDetailsOpen(!isDetailsOpen)}>
                <h3 style={{ margin: 0, color: '#f8fafc', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px', fontWeight: 700 }}>Análisis Económico y Transición Fósil</h3>
                <span style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: isDetailsOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '1.2rem', color: activeTheme.accent }}>▼</span>
            </div>

            <div style={{ maxHeight: isDetailsOpen ? '1000px' : '0px', opacity: isDetailsOpen ? 1 : 0, transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', paddingBottom: '1rem' }}>
                    {/* TRANSICIÓN ENERGÉTICA */}
                    <div className="glass-card" style={{ border: `1px solid ${activeTheme.accent}20` }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: '#cbd5e1', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 700 }}>Sustitución de Fósiles</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.5rem', borderRadius: '12px', borderLeft: `3px solid ${activeTheme.accent}` }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>Diésel</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.03em', transition: 'all 0.3s ease' }}>{dieselReemplazado} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>kg/día</span></div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.5rem', borderRadius: '12px', borderLeft: `3px solid ${activeTheme.secondary}` }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>Gas Natural</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.03em', transition: 'all 0.3s ease' }}>{gasReemplazado} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>m³/día</span></div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.5rem', borderRadius: '12px', borderLeft: `3px solid #f59e0b` }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>Gasolina</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.03em', transition: 'all 0.3s ease' }}>{gasolinaReemplazada} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>L/día</span></div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.5rem', borderRadius: '12px', borderLeft: `3px solid #ef4444` }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>Carbón Térmico</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.03em', transition: 'all 0.3s ease' }}>{carbonReemplazado} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>kg/día</span></div>
                            </div>
                        </div>
                    </div>

                    {/* ANÁLISIS ECONÓMICO LCOH */}
                    <div className="glass-card" style={{ border: `1px solid ${activeTheme.accent}20` }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: '#cbd5e1', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 700 }}>Viabilidad Financiera (LCOH)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                                    <span style={{ color: activeTheme.accent, fontWeight: 700, fontSize: '1.1rem' }}>🟢 H2 Verde (Uribia)</span>
                                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem', transition: 'all 0.3s ease' }}>${displayData?.lcoh_verde?.toFixed(2)} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>/ kg</span></span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                                    <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '1.1rem' }}>⚫ H2 Gris (Fósil)</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '1.4rem', transition: 'all 0.3s ease' }}>${displayData?.lcoh_gris?.toFixed(2)} <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>/ kg</span></span>
                                </div>
                                <div 
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', cursor: 'help' }}
                                    onMouseEnter={() => setHoveredText("El H2 Azul se produce con gas natural, pero incluye un sistema de Captura y Almacenamiento de Carbono (CCS).")}
                                    onMouseLeave={() => setHoveredText(null)}
                                >
                                    <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '1.1rem' }}>🔵 H2 Azul (Híbrido)</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '1.4rem' }}>$3.20 <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>/ kg</span></span>
                                </div>
                                <div 
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'help' }}
                                    onMouseEnter={() => setHoveredText("El H2 Turquesa usa pirólisis para descomponer el metano en hidrógeno y carbono sólido, evitando emisiones gaseosas.")}
                                    onMouseLeave={() => setHoveredText(null)}
                                >
                                    <span style={{ color: '#06b6d4', fontWeight: 600, fontSize: '1.1rem' }}>🩵 H2 Turquesa (Pirólisis)</span>
                                    <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '1.4rem' }}>$3.80 <span style={{fontSize: '0.9rem', color: '#64748b', fontWeight: 400}}>/ kg</span></span>
                                </div>
                            </div>
                            <div style={{ background: `rgba(255, 255, 255, 0.02)`, border: `1px solid ${activeTheme.accent}30`, padding: '1.5rem', borderRadius: '12px' }}>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem', lineHeight: '1.6' }}>
                                    💡 El sobrecosto operativo del Hidrógeno Verde frente a su contraparte fósil es amortizado sustancialmente. Los ahorros generados por la evasión de impuestos globales de carbono <strong>compensan la diferencia de LCOH en un <span style={{color: activeTheme.accent, fontWeight: 800, fontSize: '1.2rem'}}>{displayData?.compensacion?.toFixed(1)}%</span></strong>, optimizando el retorno de inversión (ROI) a largo plazo.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN IA (AREA CHART) */}
            <div className="glass-card" style={{ paddingBottom: '50px', width: '100%', border: `1px solid ${activeTheme.accent}30` }}>
                <h3 style={{ margin: '0 0 2rem 0', color: '#cbd5e1', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 700 }}>
                    Análisis Predictivo 24H (Red LSTM)
                </h3>
                <div id="grafica-24h" style={{ width: '100%', height: '400px', position: 'relative', padding: '10px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={displayPrediccion} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                            <defs>
                                <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#eab308" stopOpacity={0.0}/>
                                </linearGradient>
                                <linearGradient id="colorEolica" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                </linearGradient>
                                <linearGradient id="colorH2Total" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis 
                                dataKey="hora" 
                                stroke="#64748b" 
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }} 
                                dy={10} 
                                axisLine={false} 
                                tickLine={false}
                                label={{ value: 'Hora del Día (24H)', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                            />
                            <YAxis 
                                stroke="#64748b" 
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }} 
                                dx={-10} 
                                axisLine={false} 
                                tickLine={false}
                                domain={[0, maxAxisValue]}
                                label={{ value: 'Producción (kg/h)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                            />
                            <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ paddingBottom: '10px', fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: `${activeTheme.accent}50`, borderRadius: '12px', backdropFilter: 'blur(8px)', padding: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }} 
                                itemStyle={{ fontWeight: 700, fontSize: '1.2rem' }} 
                                labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem' }}
                                formatter={(value, name) => [`${value} kg/h`, name]}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="solar" 
                                name="Solar"
                                stroke="#eab308" 
                                strokeWidth={2} 
                                fill="url(#colorSolar)"
                                dot={false} 
                            />
                            <Area 
                                type="monotone" 
                                dataKey="eolica" 
                                name="Eólica"
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                fill="url(#colorEolica)"
                                dot={false} 
                            />
                            <Area 
                                type="monotone" 
                                dataKey="h2" 
                                name="H2 Total"
                                stroke="#22c55e" 
                                strokeWidth={3} 
                                fill="url(#colorH2Total)"
                                dot={{ fill: '#0f172a', stroke: '#22c55e', strokeWidth: 2, r: 4 }} 
                                activeDot={{ r: 8, fill: '#22c55e', stroke: '#0f172a', strokeWidth: 2 }} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
        </div>
        
        {/* PANEL DE EXPLICACIÓN CONTEXTUAL */}
        <div style={{
            position: 'fixed',
            bottom: '2.5rem',
            right: '2.5rem',
            width: '320px',
            padding: '1.5rem',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: `1px solid ${activeTheme.accent}50`,
            boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${activeTheme.accent}20`,
            color: '#e2e8f0',
            zIndex: 9999,
            pointerEvents: 'none',
            opacity: (hoveredText && !isDragging) ? 1 : 0,
            transform: (hoveredText && !isDragging) ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: activeTheme.accent }}>
                <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                <strong style={{ fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Información Contextual</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: '#cbd5e1' }}>
                {hoveredText}
            </p>
        </div>
    </div>
  );
}
