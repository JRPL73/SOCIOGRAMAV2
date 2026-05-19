import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  HelpCircle, 
  UserPlus, 
  PlusCircle, 
  Play, 
  Download, 
  Trash2, 
  UserCheck, 
  ChevronRight,
  Info
} from 'lucide-react';

const App = () => {
  // --- ESTADOS DE LA APLICACIÓN ---
  const [activeTab, setActiveTab] = useState('config'); // config, respuestas, resultado
  const [alumnos, setAlumnos] = useState([]);
  const [nuevoAlumno, setNuevoAlumno] = useState("");
  const [preguntas, setPreguntas] = useState([
    { id: 1, texto: "¿Con quién te gustaría trabajar?", tipo: "AFINIDAD" },
    { id: 2, texto: "¿Con quién NO te gustaría trabajar?", tipo: "RECHAZO" }
  ]);
  const [nuevaPregunta, setNuevaPregunta] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("AFINIDAD");
  const [respuestas, setRespuestas] = useState([]); // Array de { de, para, preguntaId }
  
  // Nuevos estados para la selección en columnas
  const [registroDe, setRegistroDe] = useState("");
  const [registroPara, setRegistroPara] = useState("");
  const [registroPregunta, setRegistroPregunta] = useState("");

  // Estado para el arrastre de nodos en el canvas
  const [dragState, setDragState] = useState({
    nodeId: null,
    isDragging: false,
    offsetX: 0,
    offsetY: 0
  });

  const canvasRef = useRef(null);
  // Ref para mantener los nodos actualizados fuera del ciclo de renderizado de React
  const nodesRef = useRef([]);

  // Inicializar la pregunta seleccionada por defecto
  useEffect(() => {
    if (preguntas.length > 0 && !registroPregunta) {
      setRegistroPregunta(preguntas[0].id);
    }
  }, [preguntas, registroPregunta]);

  // --- LÓGICA DE GESTIÓN ---
  const agregarAlumno = () => {
    if (nuevoAlumno.trim() && !alumnos.includes(nuevoAlumno.trim())) {
      setAlumnos([...alumnos, nuevoAlumno.trim()]);
      setNuevoAlumno("");
    }
  };

  const agregarPregunta = () => {
    if (nuevaPregunta.trim()) {
      setPreguntas([...preguntas, { 
        id: Date.now(), 
        texto: nuevaPregunta.trim(), 
        tipo: nuevoTipo 
      }]);
      setNuevaPregunta("");
    }
  };

  const eliminarAlumno = (nombre) => {
    setAlumnos(alumnos.filter(a => a !== nombre));
    setRespuestas(respuestas.filter(r => r.de !== nombre && r.para !== nombre));
  };

  const registrarVoto = (de, para, preguntaId) => {
    if (de === para) return;
    // Evitar duplicados para la misma pregunta
    const existe = respuestas.find(r => r.de === de && r.para === para && r.preguntaId === preguntaId);
    if (!existe) {
      setRespuestas([...respuestas, { de, para, preguntaId }]);
    }
  };

  const borrarRespuesta = (index) => {
    const nuevas = [...respuestas];
    nuevas.splice(index, 1);
    setRespuestas(nuevas);
  };

  // --- MOTOR DEL GRAFO (Física Simple y Arrastre) ---
  useEffect(() => {
    if (activeTab === 'resultado' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;

      // Inicializar nodos o usar los existentes si ya se crearon para mantener posiciones
      if (nodesRef.current.length === 0 || nodesRef.current.length !== alumnos.length) {
         nodesRef.current = alumnos.map(nombre => ({
          id: nombre,
          x: Math.random() * width * 0.8 + width * 0.1, // Evitar bordes iniciales
          y: Math.random() * height * 0.8 + height * 0.1,
          vx: 0,
          vy: 0,
          radius: 35
        }));
      }

      const nodes = nodesRef.current;

      const links = respuestas.map(r => {
        const p = preguntas.find(preg => preg.id === r.preguntaId);
        return {
          source: nodes.find(n => n.id === r.de),
          target: nodes.find(n => n.id === r.para),
          color: p?.tipo === "AFINIDAD" ? "#10b981" : "#ef4444"
        };
      });

      // Simulación de física (Fruchterman-Reingold simplificado)
      const animate = () => {
        // 1. Repulsión (para que no se toquen)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            let dx = nodes[i].x - nodes[j].x;
            let dy = nodes[i].y - nodes[j].y;
            let distance = Math.sqrt(dx * dx + dy * dy) || 1;
            // Aumentar la fuerza de repulsión para mayor claridad
            let force = (nodes[i].radius + nodes[j].radius + 80) / (distance * distance) * 300; 
            let fx = (dx / distance) * force;
            let fy = (dy / distance) * force;
            
            // No aplicar repulsión al nodo que se está arrastrando
            if(dragState.nodeId !== nodes[i].id) {
               nodes[i].vx += fx;
               nodes[i].vy += fy;
            }
            if(dragState.nodeId !== nodes[j].id) {
               nodes[j].vx -= fx;
               nodes[j].vy -= fy;
            }
          }
        }

        // 2. Atracción (las relaciones los juntan)
        links.forEach(l => {
          if (!l.source || !l.target) return;
          let dx = l.target.x - l.source.x;
          let dy = l.target.y - l.source.y;
          let distance = Math.sqrt(dx * dx + dy * dy) || 1;
          // Distancia ideal entre nodos conectados
          let force = (distance - 200) * 0.015; 
          let fx = (dx / distance) * force;
          let fy = (dy / distance) * force;
          
          if(dragState.nodeId !== l.source.id) {
              l.source.vx += fx;
              l.source.vy += fy;
          }
          if(dragState.nodeId !== l.target.id) {
              l.target.vx -= fx;
              l.target.vy -= fy;
          }
        });

        // 3. Gravedad al centro y actualización de posiciones
        nodes.forEach(n => {
           if (n.id !== dragState.nodeId) { // Solo aplicar física si no se está arrastrando
              // Gravedad suave al centro de la pantalla
              n.vx += (width / 2 - n.x) * 0.005;
              n.vy += (height / 2 - n.y) * 0.005;
              
              // Aplicar velocidad y fricción
              n.x += n.vx;
              n.y += n.vy;
              n.vx *= 0.85; // Fricción
              n.vy *= 0.85;

              // Límites de pantalla para que no salgan del canvas
              n.x = Math.max(n.radius, Math.min(width - n.radius, n.x));
              n.y = Math.max(n.radius, Math.min(height - n.radius, n.y));
           } else {
             // Si se arrastra, anular velocidad para evitar que "salte" al soltar
             n.vx = 0;
             n.vy = 0;
           }
        });

        // Dibujar
        ctx.clearRect(0, 0, width, height);

        // Encontrar relaciones bidireccionales
        const mutualLinks = [];
        const oneWayLinks = [];

        links.forEach(l => {
           if (!l.source || !l.target) return;
           const isMutual = links.some(otherL => 
              otherL.source.id === l.target.id && 
              otherL.target.id === l.source.id &&
              otherL.color === l.color // Misma relación (ej. ambos afinidad)
           );
           
           if (isMutual) {
               // Evitar duplicados en mutualLinks
               const alreadyAdded = mutualLinks.some(ml => 
                   (ml.source.id === l.source.id && ml.target.id === l.target.id) ||
                   (ml.source.id === l.target.id && ml.target.id === l.source.id)
               );
               if (!alreadyAdded) {
                   mutualLinks.push(l);
               }
           } else {
               oneWayLinks.push(l);
           }
        });

        // Dibujar flechas (Unidireccionales)
        oneWayLinks.forEach(l => {
          const angle = Math.atan2(l.target.y - l.source.y, l.target.x - l.source.x);
          
          // Detener la línea en el borde del círculo (radio 35)
          const radiusOffset = l.target.radius + 3;
          
          const dx = l.target.x - l.source.x;
          const dy = l.target.y - l.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < radiusOffset * 2) return;

          const startX = l.source.x + (l.source.radius + 3) * Math.cos(angle);
          const startY = l.source.y + (l.source.radius + 3) * Math.sin(angle);
          const endX = l.target.x - radiusOffset * Math.cos(angle);
          const endY = l.target.y - radiusOffset * Math.sin(angle);

          // Curva suave
          const curveOffset = 25;
          const midX = (startX + endX) / 2 - curveOffset * Math.sin(angle);
          const midY = (startY + endY) / 2 + curveOffset * Math.cos(angle);

          ctx.beginPath();
          if (l.color === "#ef4444") {
            ctx.setLineDash([8, 6]); // Rechazo: Punteada
          } else {
            ctx.setLineDash([]); // Afinidad: Sólida
          }
          
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 2.5;
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(midX, midY, endX, endY);
          ctx.stroke();
          
          ctx.setLineDash([]); 

          // Cabeza de flecha
          const headAngle = Math.atan2(endY - midY, endX - midX);
          ctx.beginPath();
          ctx.fillStyle = l.color;
          ctx.moveTo(
            endX - 16 * Math.cos(headAngle - Math.PI / 6),
            endY - 16 * Math.sin(headAngle - Math.PI / 6)
          );
          ctx.lineTo(endX, endY);
          ctx.lineTo(
            endX - 16 * Math.cos(headAngle + Math.PI / 6),
            endY - 16 * Math.sin(headAngle + Math.PI / 6)
          );
          ctx.fill();
        });

        // Dibujar flechas (Bidireccionales - Línea recta con doble flecha)
        mutualLinks.forEach(l => {
          const angle = Math.atan2(l.target.y - l.source.y, l.target.x - l.source.x);
          
          const sourceRadiusOffset = l.source.radius + 3;
          const targetRadiusOffset = l.target.radius + 3;
          
          const dx = l.target.x - l.source.x;
          const dy = l.target.y - l.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < sourceRadiusOffset + targetRadiusOffset) return;

          const startX = l.source.x + sourceRadiusOffset * Math.cos(angle);
          const startY = l.source.y + sourceRadiusOffset * Math.sin(angle);
          const endX = l.target.x - targetRadiusOffset * Math.cos(angle);
          const endY = l.target.y - targetRadiusOffset * Math.sin(angle);

          ctx.beginPath();
           if (l.color === "#ef4444") {
            ctx.setLineDash([8, 6]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 3.5; // Un poco más gruesa para destacar reciprocidad
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Cabeza de flecha hacia Target
          ctx.beginPath();
          ctx.fillStyle = l.color;
          ctx.moveTo(
            endX - 16 * Math.cos(angle - Math.PI / 6),
            endY - 16 * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(endX, endY);
          ctx.lineTo(
            endX - 16 * Math.cos(angle + Math.PI / 6),
            endY - 16 * Math.sin(angle + Math.PI / 6)
          );
          ctx.fill();

           // Cabeza de flecha hacia Source (Invertida)
          ctx.beginPath();
          ctx.fillStyle = l.color;
          ctx.moveTo(
            startX + 16 * Math.cos(angle - Math.PI / 6),
            startY + 16 * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(startX, startY);
          ctx.lineTo(
            startX + 16 * Math.cos(angle + Math.PI / 6),
            startY + 16 * Math.sin(angle + Math.PI / 6)
          );
          ctx.fill();
        });

        // Calcular grado de entrada (popularidad) para estilo del nodo
        const inDegree = {};
        nodes.forEach(n => inDegree[n.id] = 0);
        links.forEach(l => {
            if(l.target && l.color === "#10b981") inDegree[l.target.id]++; // Solo contamos afinidad para destacar
        });

        // Dibujar Nodos
        nodes.forEach(n => {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          
          // Estilo base
          ctx.fillStyle = "#ffffff";
          
          // Destacar nodos "Estrella" (muchos votos de afinidad entrantes)
          if (inDegree[n.id] >= 3) {
             ctx.strokeStyle = "#fbbf24"; // Dorado para populares
             ctx.lineWidth = 5;
             ctx.shadowColor = "rgba(251, 191, 36, 0.5)";
             ctx.shadowBlur = 10;
          } 
          // Destacar nodos aislados (0 votos de afinidad entrantes y salientes)
          else {
             const hasConnections = links.some(l => l.source?.id === n.id || l.target?.id === n.id);
             ctx.strokeStyle = hasConnections ? "#3b82f6" : "#94a3b8"; // Gris si está aislado
             ctx.lineWidth = 3;
             ctx.shadowBlur = 0;
          }

          // Resaltar nodo arrastrado
          if (dragState.nodeId === n.id) {
             ctx.fillStyle = "#f8fafc";
             ctx.strokeStyle = "#2563eb";
             ctx.shadowColor = "rgba(37, 99, 235, 0.6)";
             ctx.shadowBlur = 15;
          }

          ctx.fill();
          ctx.stroke();
          
          // Reset shadow para texto
          ctx.shadowBlur = 0;

          // Texto del nodo
          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          
          // Truncar nombre si es muy largo
          let displayName = n.id;
          if (ctx.measureText(displayName).width > n.radius * 2 - 10) {
             displayName = displayName.substring(0, 6) + "...";
          }
          ctx.fillText(displayName, n.x, n.y);
          
          // Mostrar conteo de popularidad si es > 0
          if (inDegree[n.id] > 0) {
              ctx.beginPath();
              ctx.arc(n.x + n.radius - 5, n.y - n.radius + 5, 10, 0, Math.PI*2);
              ctx.fillStyle = "#10b981";
              ctx.fill();
              ctx.fillStyle = "white";
              ctx.font = "bold 10px sans-serif";
              ctx.fillText(inDegree[n.id], n.x + n.radius - 5, n.y - n.radius + 5);
          }
        });

        if (activeTab === 'resultado') requestAnimationFrame(animate);
      };

      const animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    }
  }, [activeTab, alumnos, respuestas, preguntas, dragState]); // Dependencia de dragState crucial


  // --- CONTROLADORES DE EVENTOS PARA ARRASTRE ---
  const handleMouseDown = (e) => {
      if (activeTab !== 'resultado' || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      // Escalar coordenadas si el canvas está redimensionado por CSS
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      // Buscar si hicimos clic en algún nodo (reverso para priorizar los dibujados encima)
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          const dx = mouseX - n.x;
          const dy = mouseY - n.y;
          if (dx * dx + dy * dy <= n.radius * n.radius) {
              setDragState({
                  nodeId: n.id,
                  isDragging: true,
                  offsetX: dx,
                  offsetY: dy
              });
              break; // Solo arrastrar uno
          }
      }
  };

  const handleMouseMove = (e) => {
      if (!dragState.isDragging || activeTab !== 'resultado' || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      // Actualizar posición del nodo en el ref
      const nodeIndex = nodesRef.current.findIndex(n => n.id === dragState.nodeId);
      if (nodeIndex !== -1) {
          nodesRef.current[nodeIndex].x = mouseX - dragState.offsetX;
          nodesRef.current[nodeIndex].y = mouseY - dragState.offsetY;
      }
  };

  const handleMouseUp = () => {
      if (dragState.isDragging) {
          setDragState({ nodeId: null, isDragging: false, offsetX: 0, offsetY: 0 });
      }
  };

  const descargarImagen = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'sociograma.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* HEADER */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SocioGrafo Web Pro</h1>
            <p className="text-xs text-slate-500">Gestión de relaciones escolares</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'config' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            1. Configurar
          </button>
          <button 
            onClick={() => setActiveTab('respuestas')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'respuestas' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            2. Respuestas
          </button>
          <button 
            onClick={() => setActiveTab('resultado')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'resultado' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            3. Sociograma
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        
        {/* PANEL DE CONFIGURACIÓN */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Alumnos */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4 text-blue-600">
                <UserPlus size={20} />
                <h2 className="font-bold text-lg">Lista de Alumnos</h2>
              </div>
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={nuevoAlumno}
                  onChange={(e) => setNuevoAlumno(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && agregarAlumno()}
                  placeholder="Ej: Ana García" 
                  className="flex-1 border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                />
                <button onClick={agregarAlumno} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition">
                  Añadir
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alumnos.map(a => (
                  <div key={a} className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-lg group">
                    <span className="font-medium text-slate-700">{a}</span>
                    <button onClick={() => eliminarAlumno(a)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {alumnos.length === 0 && <p className="text-slate-400 text-center py-4 italic">No hay alumnos todavía.</p>}
              </div>
            </div>

            {/* Preguntas */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4 text-purple-600">
                <HelpCircle size={20} />
                <h2 className="font-bold text-lg">Preguntas del Test</h2>
              </div>
              <div className="space-y-3 mb-4">
                <input 
                  type="text" 
                  value={nuevaPregunta}
                  onChange={(e) => setNuevaPregunta(e.target.value)}
                  placeholder="Ej: ¿Con quién te gusta salir al recreo?" 
                  className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-400 outline-none"
                />
                <div className="flex gap-2">
                  <select 
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value)}
                    className="flex-1 border rounded-xl px-4 py-2 bg-white"
                  >
                    <option value="AFINIDAD">Elección Positiva (Afinidad)</option>
                    <option value="RECHAZO">Elección Negativa (Rechazo)</option>
                  </select>
                  <button onClick={agregarPregunta} className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition">
                    Añadir
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {preguntas.map(p => (
                  <div key={p.id} className="p-3 border rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">{p.texto}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.tipo === 'AFINIDAD' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.tipo}
                      </span>
                    </div>
                    <button onClick={() => setPreguntas(preguntas.filter(x => x.id !== p.id))} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL DE RESPUESTAS */}
        {activeTab === 'respuestas' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-2xl shadow-sm border mb-8">
              <div className="flex items-center gap-2 mb-6 text-green-600">
                <UserCheck size={20} />
                <h2 className="font-bold text-lg">Registrar Datos</h2>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 mb-2">1. SELECCIONA LA PREGUNTA</label>
                  <select 
                    value={registroPregunta}
                    onChange={(e) => setRegistroPregunta(Number(e.target.value))}
                    className="w-full md:w-1/2 border rounded-lg px-3 py-2 bg-white"
                  >
                    {preguntas.map(p => <option key={p.id} value={p.id}>{p.texto}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Columna Origen */}
                  <div className="bg-white border rounded-xl overflow-hidden flex flex-col h-64 shadow-sm">
                    <div className="bg-slate-100 p-3 text-xs font-bold text-slate-600 text-center border-b">
                      2. EL ALUMNO...
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                      {alumnos.map(a => (
                        <button
                          key={a}
                          onClick={() => setRegistroDe(a)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${registroDe === a ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200' : 'hover:bg-slate-50 text-slate-700'}`}
                        >
                          {a}
                        </button>
                      ))}
                      {alumnos.length === 0 && <p className="text-xs text-slate-400 text-center p-4">Añade alumnos en Configurar</p>}
                    </div>
                  </div>

                  {/* Columna Destino */}
                  <div className="bg-white border rounded-xl overflow-hidden flex flex-col h-64 shadow-sm">
                    <div className="bg-slate-100 p-3 text-xs font-bold text-slate-600 text-center border-b">
                      3. ELIGIÓ A...
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                      {alumnos.map(a => (
                        <button
                          key={a}
                          onClick={() => setRegistroPara(a)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${registroPara === a ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200' : 'hover:bg-slate-50 text-slate-700'}`}
                        >
                          {a}
                        </button>
                      ))}
                      {alumnos.length === 0 && <p className="text-xs text-slate-400 text-center p-4">Añade alumnos en Configurar</p>}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => {
                      if (registroDe && registroPara && registroPregunta) {
                        registrarVoto(registroDe, registroPara, registroPregunta);
                        // Limpiamos solo "Para" para facilitar el ingreso de votos continuos de un mismo alumno
                        setRegistroPara(""); 
                      }
                    }}
                    disabled={!registroDe || !registroPara || !registroPregunta || registroDe === registroPara}
                    className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition"
                  >
                    <PlusCircle size={20} /> Registrar Voto
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Alumno Origen</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Relación</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Alumno Destino</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Pregunta</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {respuestas.map((r, idx) => {
                    const p = preguntas.find(x => x.id === r.preguntaId);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-medium">{r.de}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block w-8 h-0.5 align-middle ${p?.tipo === 'AFINIDAD' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <ChevronRight size={14} className={`inline ${p?.tipo === 'AFINIDAD' ? 'text-green-500' : 'text-red-500'}`} />
                        </td>
                        <td className="px-6 py-4 font-medium">{r.para}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 italic">{p?.texto}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => borrarRespuesta(idx)} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {respuestas.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <Info className="mx-auto mb-2 opacity-20" size={48} />
                  <p>No has registrado ninguna respuesta todavía.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL DE RESULTADO (GRAFO) */}
        {activeTab === 'resultado' && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="bg-white p-4 rounded-2xl shadow-xl border overflow-hidden relative group">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button 
                  onClick={descargarImagen}
                  className="bg-orange-500 text-white p-3 rounded-xl shadow-lg hover:bg-orange-600 transition flex items-center gap-2 font-bold"
                >
                  <Download size={20} /> Exportar Imagen
                </button>
              </div>
              
              <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur border rounded-lg p-4 text-[11px] uppercase font-bold text-slate-600 space-y-2 shadow-sm">
                <div className="font-extrabold text-xs mb-1 border-b pb-1">Leyenda Visual</div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-green-500 rounded"></div> Afinidad (Unidireccional)
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 border-t-2 border-dashed border-red-500"></div> Rechazo
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1.5 bg-green-500 rounded flex items-center justify-between"><span className="w-0.5 h-full bg-white opacity-50"></span></div> Afinidad Recíproca
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                  <div className="w-4 h-4 rounded-full border-2 border-yellow-400 bg-white shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div> Popular / Líder
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-4 h-4 rounded-full border-2 border-slate-400 bg-white"></div> Aislado
                </div>
                <div className="pt-2 text-[9px] text-slate-400 italic normal-case font-normal border-t mt-2">
                  * Puedes arrastrar los nodos para organizarlos.
                </div>
              </div>

              {}
              <canvas 
                ref={canvasRef} 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp} // Soltar si el ratón sale del canvas
                className={`w-full h-[650px] ${dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab'} rounded-xl bg-slate-50 border border-slate-100`}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-slate-400 text-sm">
        SocioGrafo Web &bull; Herramienta de Análisis Grupal &bull; 2024
      </footer>
    </div>
  );
};

export default App;
