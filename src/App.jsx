
import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import Background from './components/Background'
import Selector from './components/TournamentSelector'
import { listTournaments, getTournament, saveTournament, deleteTournament, slugify } from './components/Storage'
import { loadTemplates, getTemplate } from './components/TournamentTemplates'
import TemplateManager from './components/TemplateManager'

const RESULT = { P1:'P1', P2:'P2', DRAW:'DRAW', BYE:'BYE' }
// Puntos por defecto que se pueden sobrescribir con la configuración de la plantilla
const DEFAULT_POINTS = { WIN:3, DRAW:1, LOSS:0, BYE:3 }
const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2,9)
const todayISO = () => new Date().toISOString().slice(0,10)

function emptyTournament(name='Mi Torneo CSWO', templateId=null){
  const slug = slugify(name)
  
  // Configuración base
  let tournamentConfig = {
    maxRounds: 5,
    pointsSystem: { WIN: 3, DRAW: 1, LOSS: 0, BYE: 3 },
    tiebreakers: ['points', 'omw', 'wins', 'name'],
    drawAllowed: true,
    logo: null
  }
  
  // Si se proporciona un ID de plantilla, aplicar la configuración de la plantilla
  if (templateId) {
    const template = getTemplate(templateId)
    if (template) {
      tournamentConfig = {
        ...tournamentConfig,
        ...template.config,
        templateId: template.id,
        templateName: template.name,
        system: template.system
      }
    }
  }
  
  return { 
    slug, 
    meta: { 
      name, 
      date: todayISO(), 
      ...tournamentConfig 
    }, 
    players: [], 
    rounds: [], 
    finished: false, 
    createdAt: Date.now(), 
    updatedAt: Date.now() 
  }
}
function calcStandings(t){
  // Obtener la configuración de puntos de la plantilla si existe, o usar los valores por defecto
  const POINTS = t.meta.pointsSystem || DEFAULT_POINTS;
  const res = {}
  t.players.forEach(p => res[p.id] = { id:p.id, name:p.name, points:0, wins:0, draws:0, losses:0, omw:0, _mw:0, opps:new Set(), byes:0, dropped:p.dropped || false })
  t.rounds.forEach(r => r.pairings.forEach(m => {
    if(!m.p2 && m.result===RESULT.BYE){ const a=res[m.p1]; if(!a) return; a.points+=POINTS.BYE; a.wins++; a.byes++; return }
    const a=res[m.p1]; const b=res[m.p2]; if(!a||!b) return
    a.opps.add(b.id); b.opps.add(a.id)
    if(!m.result) return
    // Manejar los casos de jugadores en estado drop
    if(a.dropped && b.dropped) {
      // Si ambos jugadores están en drop, ambos reciben 0 puntos pero se registra como partida jugada
      a.losses++; b.losses++;
    } else if(a.dropped) {
      // Si solo el jugador A está en drop, B gana automáticamente
      b.points+=POINTS.WIN; b.wins++; a.losses++;
    } else if(b.dropped) {
      // Si solo el jugador B está en drop, A gana automáticamente
      a.points+=POINTS.WIN; a.wins++; b.losses++;
    } else if(m.result===RESULT.P1){ 
      a.points+=POINTS.WIN; a.wins++; b.losses++ 
    } else if(m.result===RESULT.P2){ 
      b.points+=POINTS.WIN; b.wins++; a.losses++ 
    } else if(m.result===RESULT.DRAW){ 
      a.points+=POINTS.DRAW; b.points+=POINTS.DRAW; a.draws++; b.draws++ 
    }
  }))
  const mw = p => { const tot=p.wins+p.draws+p.losses; return tot? (p.wins+0.5*p.draws)/tot : 0 }
  Object.values(res).forEach(p => p._mw = mw(p))
  Object.values(res).forEach(p => { const o=[...p.opps]; p.omw = o.length? o.reduce((acc,id)=>acc+(res[id]?._mw||0),0)/o.length : 0 })
  // Utilizar los criterios de desempate de la plantilla si existen
  const tiebreakers = t.meta.tiebreakers || ['points', 'omw', 'wins', 'name'];
  
  return Object.values(res).sort((a,b)=> {
    // Ordenar según los criterios de desempate configurados
    for (const tiebreaker of tiebreakers) {
      if (tiebreaker === 'points' && b.points !== a.points) {
        return b.points - a.points;
      } else if (tiebreaker === 'omw' && b.omw !== a.omw) {
        return b.omw - a.omw;
      } else if (tiebreaker === 'wins' && b.wins !== a.wins) {
        return b.wins - a.wins;
      } else if (tiebreaker === 'name') {
        return a.name.localeCompare(b.name);
      }
    }
    return 0;
  }).map((p,i)=>({ rank:i+1, ...p }))
}
function hasPlayed(t,a,b){ return t.rounds.some(r=> r.pairings.some(m=> (m.p1===a&&m.p2===b)||(m.p1===b&&m.p2===a) )) }
function swissPairings(t){
  const base = Math.max(1, t.rounds.reduce((acc,r)=> Math.max(acc, ...(r.pairings.map(m=>m.table)) ), 0) + 1)
  const actives = t.players.filter(p=>!p.dropped)
  const st = calcStandings(t)
  const ordered = actives.map(p=>({...p, points: st.find(s=>s.id===p.id)?.points||0})).sort((a,b)=> b.points-a.points || a.name.localeCompare(b.name))
  const ids = ordered.map(p=>p.id)
  const pairs = []

  if(ordered.length % 2 === 1){
    const cand = [...ordered].reverse().find(p=> !t.rounds.some(r=> r.pairings.some(m=> m.p1===p.id && m.result===RESULT.BYE )))
    if(cand){ ids.splice(ids.indexOf(cand.id),1); pairs.push({ id:uid('m'), table: base+pairs.length, p1:cand.id, p2:null, p1Wins:2, p2Wins:0, result:RESULT.BYE }) }
  }
  while(ids.length){
    const a = ids.shift()
    let idx = ids.findIndex(b=> !hasPlayed(t,a,b) )
    if(idx===-1) idx = 0
    const b = ids.splice(idx,1)[0]
    if(!b) break
    pairs.push({ id:uid('m'), table: base+pairs.length, p1:a, p2:b, p1Wins:0, p2Wins:0, result:null })
  }
  return pairs
}
function determineResult(m){
  if(!m.p2) return RESULT.BYE
  if(m.p1Wins>m.p2Wins) return RESULT.P1
  if(m.p2Wins>m.p1Wins) return RESULT.P2
  if(m.p1Wins===m.p2Wins && (m.p1Wins>0||m.p2Wins>0)) return RESULT.DRAW
  return null
}

export default function App({ initialTournament, onTournamentChange, initialViewMode, viewSlug }){
  // Estado para el gestor de plantillas
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const qp = new URLSearchParams(location.search)
  // Usar el viewSlug pasado como prop o el de la URL
  const urlViewSlug = viewSlug || qp.get('t')
  // Determinar si estamos en modo visor por props o URL
  const isViewer = initialViewMode || qp.has('view') || (qp.get('mode')==='view')

  const [mode, setMode] = useState(urlViewSlug && isViewer ? 'viewer' : initialTournament ? 'organizer' : 'selector')
  const [t, setT] = useState(()=> {
    if (urlViewSlug) {
      const tournament = getTournament(urlViewSlug);
      // Si no encontramos el torneo en localStorage, creamos uno vacío pero marcamos que no hay datos
      if (!tournament && isViewer) {
        const emptyT = emptyTournament('Torneo CSWO');
        emptyT._noLocalData = true; // Marca para indicar que no hay datos locales
        emptyT.slug = urlViewSlug; // Mantenemos el slug original
        return emptyT;
      }
      return tournament || emptyTournament('Torneo CSWO');
    } else if (initialTournament) {
      return initialTournament
    } else {
      return emptyTournament('Torneo CSWO')
    }
  })
  
  useEffect(()=>{
    saveTournament(t)
    if (onTournamentChange) {
      onTournamentChange(t)
    }
  }, [t, onTournamentChange])

  const byId = useMemo(()=> Object.fromEntries(t.players.map(p=>[p.id,p])) , [t.players])
  const standings = useMemo(()=> calcStandings(t), [t.players, t.rounds])
  const current = t.rounds[t.rounds.length-1]
  const roundCounter = `${t.rounds.length} / ${t.meta.maxRounds}`
  const stateLabel = t.finished ? 'FINALIZADO' : current && current.pairings.some(m=>!m.result) ? 'RONDA EN PROGRESO' : 'EN CURSO'

  // actions
  const addPlayer = (nm) => { nm=String(nm||'').trim(); if(!nm) return; setT({...t, players:[...t.players, {id:uid('p'), name:nm, dropped:false}]}) }
  const bulkTextAdd = (txt) => {
    const list = String(txt||'').split(/\\r?\\n|,|;/).map(s=>s.trim()).filter(Boolean)
    if(!list.length) return
    const exist = new Set(t.players.map(p=>p.name.toLowerCase()))
    const toAdd = list.filter(n=>!exist.has(n.toLowerCase())).map(n=>({id:uid('p'), name:n, dropped:false}))
    setT({...t, players:[...t.players, ...toAdd]})
  }
  const startRound = () => {
    // Verificar que hay suficientes jugadores activos para iniciar la ronda
    const activePlayers = t.players.filter(p => !p.dropped);
    
    if(activePlayers.length < 2) {
      return alert('Necesitas al menos 2 jugadores activos (no en estado drop) para iniciar una ronda');
    }
    
    if(current && current.pairings.some(m=>!m.result)) {
      return alert('Faltan resultados en la ronda actual');
    }
    
    // Generar los emparejamientos para la nueva ronda
    const pairs = swissPairings(t);
    
    // Crear la nueva ronda
    setT({...t, rounds:[...t.rounds, {number:t.rounds.length+1, pairings:pairs}], finished:false});
  }
  const updateScore = (rid,mid,field,val) => {
    setT({...t, rounds: t.rounds.map(r=> r.number!==rid? r : ({...r, pairings: r.pairings.map(m=> m.id!==mid? m : ({...m, [field]: Math.max(0, Math.min(3, parseInt(val||0))) }))}))})
  }
  const saveResult = (rid,mid) => {
    // Encontrar el emparejamiento actual
    const currentRound = t.rounds.find(r => r.number === rid);
    const currentMatch = currentRound?.pairings.find(m => m.id === mid);
    
    if (currentMatch) {
      // Comprobar si alguno de los jugadores está en estado drop
      const p1Dropped = t.players.find(p => p.id === currentMatch.p1)?.dropped;
      const p2Dropped = currentMatch.p2 ? t.players.find(p => p.id === currentMatch.p2)?.dropped : false;
      
      let updatedMatch = {...currentMatch};
      
      // Establecer automáticamente el resultado basado en el estado drop
      if (p1Dropped && p2Dropped) {
        // Ambos en drop = ambos pierden
        updatedMatch = { ...updatedMatch, result: 'DRAW', p1Wins: 0, p2Wins: 0 };
      } else if (p1Dropped) {
        // Jugador 1 en drop = Jugador 2 gana 2-0
        updatedMatch = { ...updatedMatch, result: 'P2', p1Wins: 0, p2Wins: 2 };
      } else if (p2Dropped) {
        // Jugador 2 en drop = Jugador 1 gana 2-0
        updatedMatch = { ...updatedMatch, result: 'P1', p1Wins: 2, p2Wins: 0 };
      } else {
        // Caso normal = determinar resultado basado en los marcadores
        updatedMatch = { ...updatedMatch, result: determineResult(currentMatch) };
      }
      
      setT({...t, rounds: t.rounds.map(r => 
        r.number !== rid ? r : {
          ...r, 
          pairings: r.pairings.map(m => m.id !== mid ? m : updatedMatch)
        }
      )})
    } else {
      // Comportamiento original si no encontramos el emparejamiento
      setT({...t, rounds: t.rounds.map(r=> r.number!==rid? r : ({...r, pairings: r.pairings.map(m=> m.id!==mid? m : ({...m, result: determineResult(m) }))}))});
    }
  }
  const deleteRound = (roundNumber) => {
    // Mostrar confirmación antes de eliminar
    if (!confirm(`¿Estás seguro de que deseas eliminar la ronda ${roundNumber}? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    // Solo permitir eliminar la última ronda
    if (roundNumber !== t.rounds.length) {
      return alert('Solo puedes eliminar la última ronda del torneo');
    }
    
    // Eliminar la ronda
    const updatedRounds = t.rounds.filter(r => r.number !== roundNumber);
    setT({...t, rounds: updatedRounds});
  }
  
  const finish = () => {
    if(t.rounds.some(r=> r.pairings.some(m=> m.p2 && !m.result))) return alert('Hay partidas sin resultado')
    setT({...t, finished:true})
  }
  const exportPDF = (type) => {
    const doc = new jsPDF()
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(0,191,255)
    doc.text('COMUNIDAD CSWO — Arena Manager', 105, 16, { align:'center' })
    doc.setDrawColor(0,191,255); doc.line(15,18,195,18)
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0)
    doc.text(`Torneo: ${t.meta.name}`, 16, 24); doc.text(`Fecha: ${t.meta.date}`, 100, 24); doc.text(`Ronda: ${roundCounter}`, 160, 24)
    let y = 32

    if(type==='rounds'){
      t.rounds.forEach(r => {
        doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(`Ronda ${r.number}`, 16, y); y+=6
        doc.setFont('helvetica','normal'); doc.setFontSize(11)
        r.pairings.forEach(m => {
          const p1 = byId[m.p1]?.name || '??'
          const p2 = m.p2? (byId[m.p2]?.name || '??') : 'BYE'
          const res = m.result===RESULT.P1? 'Gana A' : m.result===RESULT.P2? 'Gana B' : m.result===RESULT.DRAW? 'Empate' : ''
          doc.text(`Mesa ${m.table}: ${p1} (${m.p1Wins||0}) vs ${p2} (${m.p2Wins||0}) ${res}`, 20, y); y+=6
          if (y>280) { doc.addPage(); y=20 }
        })
        y+=4; if (y>280) { doc.addPage(); y=20 }
      })
      doc.setFont('helvetica','italic'); doc.setTextColor(0,0,0); doc.text('By CSWO Team', 105, 290, {align:'center'})
      doc.save('CSWO_Rondas.pdf'); return
    }

    const st = standings
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Clasificación', 16, y); y+=6
    doc.text('#',16,y); doc.text('Jugador',24,y); doc.text('Pts',120,y); doc.text('W',140,y); doc.text('D',150,y); doc.text('L',160,y); doc.text('OMW%',174,y,{align:'right'}); y+=4
    doc.setDrawColor(150); doc.line(16,y,194,y); y+=6
    doc.setFont('helvetica','normal')
    st.forEach(p=>{ doc.text(String(p.rank),16,y); doc.text(p.name,24,y); doc.text(String(p.points),120,y); doc.text(String(p.wins),140,y); doc.text(String(p.draws),150,y); doc.text(String(p.losses),160,y); doc.text((p.omw*100).toFixed(1),174,y,{align:'right'}); y+=6; if(y>280){ doc.addPage(); y=20 } })
    doc.setFont('helvetica','italic'); doc.setTextColor(0,0,0); doc.text('By CSWO Team', 105, 290, {align:'center'})
    doc.save(type==='final' ? 'CSWO_Clasificacion_Final.pdf' : 'CSWO_Clasificacion.pdf')
  }
  const genLink = () => {
    // Crear una URL absoluta basada en la ubicación actual
    const url = new URL(window.location.origin)
    
    // Agregar los parámetros necesarios para el modo visor
    url.searchParams.set('t', t.slug)
    url.searchParams.set('view', '1')
    
    // Generar un código de torneo portable
    const tournamentData = JSON.stringify(t);
    
    // Mostrar un diálogo con opciones
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 20px; max-width: 500px; background: rgba(13,17,23,0.95); border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
        <h3 style="margin-top: 0; color: #22d3ee; font-size: 18px;">Compartir torneo</h3>
        <p style="margin-bottom: 15px; color: #e5e7eb; font-size: 14px;">
          Hay dos formas de compartir este torneo:
        </p>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #e5e7eb; font-size: 16px; margin-bottom: 10px;">1. Enlace público (solo vista)</h4>
          <div style="display: flex; gap: 10px; margin-bottom: 5px;">
            <input id="publicLink" readonly value="${url.toString()}" style="flex-grow: 1; padding: 8px; border-radius: 5px; background: rgba(255,255,255,0.1); color: white; border: none;">
            <button id="copyLinkBtn" style="padding: 8px; background: #0284c7; color: white; border: none; border-radius: 5px;">Copiar</button>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 5px;">
            Este enlace permite ver el torneo pero NO contiene los datos. Si tu servidor no está online, los datos no serán visibles.
          </p>
        </div>
        
        <div>
          <h4 style="color: #e5e7eb; font-size: 16px; margin-bottom: 10px;">2. Código portable (contiene datos)</h4>
          <p style="color: #9ca3af; font-size: 12px; margin-bottom: 10px;">
            Usa esta opción para generar un archivo con todos los datos del torneo que se puede importar en otro dispositivo.
          </p>
          <div style="display: flex; justify-content: space-between;">
            <button id="exportJsonBtn" style="padding: 8px 12px; background: #0284c7; color: white; border: none; border-radius: 5px;">
              Exportar JSON
            </button>
            <button id="closeBtn" style="padding: 8px 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 5px;">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modal = document.createElement('div');
    modal.style = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 9999;';
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    // Eventos para los botones
    document.getElementById('copyLinkBtn').addEventListener('click', () => {
      const linkInput = document.getElementById('publicLink');
      linkInput.select();
      document.execCommand('copy');
      alert('Enlace copiado al portapapeles');
    });
    
    document.getElementById('exportJsonBtn').addEventListener('click', () => {
      const data = JSON.stringify(t, null, 2);
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `torneo-${t.slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    
    document.getElementById('closeBtn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', e => {
      if (e.target === modal) document.body.removeChild(modal);
    });
  }

  // Ya no usamos el modo selector por defecto, pero lo mantenemos para compatibilidad con vistas existentes
  if(mode==='selector' && !initialTournament){
    return <Selector onCreate={(name)=>{ const nt=emptyTournament(name); saveTournament(nt); setT(nt); setMode('organizer') }}
                     onOpen={(slug)=>{ const nt=getTournament(slug); if(nt){ setT(nt); setMode('organizer') } }}
                     onDelete={(slug)=>{ deleteTournament(slug); location.reload() }} />
  }

  if(urlViewSlug && (isViewer || mode==='viewer')){
    // Si no hay datos locales disponibles, mostramos un mensaje especial
    if (t._noLocalData) {
      return (
        <div className='min-h-screen text-white'>
          <Background/>
          <header className='sticky top-0 z-10 backdrop-blur bg-black/40 border-b border-white/10'>
            <div className='max-w-6xl mx-auto px-4 py-4 flex items-center justify-between'>
              <div>
                <h1 className='text-2xl font-extrabold neon-title'>COMUNIDAD CSWO</h1>
                <div className='text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded inline-block mt-1'>Vista pública de solo lectura</div>
              </div>
            </div>
          </header>
          <main className='max-w-md mx-auto px-4 py-12'>
            <div className='card'>
              <div className='text-center'>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className='mx-auto text-yellow-400/70 mb-4'>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h2 className='text-xl font-bold text-cyan-300 mb-2'>No se encontraron datos locales</h2>
                <p className='text-gray-300 mb-6'>No pudimos encontrar los datos del torneo <strong>{urlViewSlug}</strong> en este dispositivo. Si estás viendo este enlace desde otro dispositivo, necesitarás importar el archivo JSON del torneo.</p>
                
                <div className='space-y-4'>
                  <a href={`?import=1`} className='btn block w-full py-3'>
                    Importar datos del torneo
                  </a>
                  <p className='text-sm text-gray-400'>Solicita al organizador del torneo que te envíe el archivo JSON del torneo. El organizador puede generar este archivo desde la opción "Compartir" en el panel principal.</p>
                </div>
              </div>
            </div>
          </main>
          <footer className='text-center text-gray-400 py-8'>
            <div className='text-xs'>
              © {new Date().getFullYear()} CSWO Team - Arena Manager
            </div>
          </footer>
        </div>
      )
    }
    
    return (
      <div className='min-h-screen text-white'>
        <Background/>
        <header className='sticky top-0 z-10 backdrop-blur bg-black/40 border-b border-white/10'>
          <div className='max-w-6xl mx-auto px-4 py-4 flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-extrabold neon-title'>COMUNIDAD CSWO</h1>
              <div className='text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded inline-block mt-1'>Vista pública de solo lectura</div>
            </div>
            <Status label={stateLabel} round={roundCounter} />
          </div>
        </header>
        <main className='max-w-6xl mx-auto px-4 py-6'>
          <section className='card'>
            <div className='flex items-center justify-between flex-wrap gap-2'>
              <div>
                <h2 className='text-xl font-bold text-cyan-300'>Torneo: {t.meta.name}</h2>
                <p className='text-gray-300 text-sm'>Fecha: {t.meta.date}</p>
              </div>
              <div className='flex gap-2'>
                <button onClick={()=>exportPDF('standings')} className='btn-ghost text-sm flex items-center gap-1'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  Descargar PDF
                </button>
                <button onClick={() => {
                  const shareUrl = window.location.href;
                  if (navigator.share) {
                    navigator.share({
                      title: `Torneo ${t.meta.name} - CSWO`,
                      text: `Resultados del torneo ${t.meta.name} de CSWO`,
                      url: shareUrl,
                    })
                  } else {
                    navigator.clipboard.writeText(shareUrl);
                    alert('Enlace copiado al portapapeles. \nCompártelo en tus redes sociales!');
                  }
                }} className='btn-ghost text-sm flex items-center gap-1'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                  Compartir
                </button>
              </div>
            </div>
          </section>
          <section className='card mt-4'>
            <h3 className='text-lg font-semibold text-cyan-300'>Rondas</h3>
            {t.rounds.length===0? <p className='text-gray-400'>Aún no hay rondas.</p> :
              t.rounds.map(r=>(
                <details key={r.number} className='mt-2 bg-white/5 rounded-xl p-3 border border-white/10' open>
                  <summary className='cursor-pointer select-none'>Ronda {r.number}</summary>
                  <div className='mt-2 space-y-2'>
                    {r.pairings.map(m=>{
                      const p1=byId[m.p1]?.name||'??'; const p2=m.p2? (byId[m.p2]?.name||'??') : 'BYE'
                      return (
                        <div key={m.id} className='flex flex-wrap items-center justify-between border-b border-white/10 pb-2 hover:bg-white/5 p-1 rounded'>
                          <div>
                            <span className='text-gray-400 text-xs mr-2 bg-white/10 px-1.5 py-0.5 rounded'>Mesa {m.table}</span>
                            <span className={byId[m.p1]?.dropped ? 'line-through text-gray-400' : ''}>{p1}</span>
                            <span className='text-gray-500 mx-1'>vs</span>
                            <span className={m.p2 && byId[m.p2]?.dropped ? 'line-through text-gray-400' : ''}>{p2}</span>
                            {byId[m.p1]?.dropped && <span className='text-yellow-400 text-xs ml-1'>(Drop)</span>}
                            {m.p2 && byId[m.p2]?.dropped && <span className='text-yellow-400 text-xs ml-1'>(Drop)</span>}
                          </div>
                          <div className='text-sm'>
                            {m.result ? (
                              <div className='flex items-center gap-2'>
                                <span className={`px-2 py-0.5 rounded ${m.result === 'P1' ? 'bg-green-500/20 text-green-300' : 
                                  m.result === 'P2' ? 'bg-blue-500/20 text-blue-300' : 
                                  'bg-yellow-500/20 text-yellow-300'}`}>
                                  {m.p1Wins || 0} - {m.p2Wins || 0}
                                </span>
                                <span className='text-gray-300'>
                                  {m.result === 'P1' ? 'Gana ' + p1 : 
                                   m.result === 'P2' ? 'Gana ' + p2 : 
                                   'Empate'}
                                </span>
                              </div>
                            ) : <span className='text-gray-500 italic'>Pendiente</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ))
            }
          </section>
          <section className='card mt-4'>
            <div className='flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-cyan-300'>Clasificación</h3>
              {t.finished && <div className='bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs'>TORNEO FINALIZADO</div>}
            </div>
            {standings.length===0? <p className='text-gray-400'>Sin datos aún.</p> :
              <div className='mt-4 overflow-x-auto'>
                <table className='w-full text-left border-collapse'>
                  <thead>
                    <tr className='bg-gradient-to-r from-cyan-900/40 to-blue-900/40'>
                      <th className='px-3 py-2 rounded-l-lg'>#</th>
                      <th className='px-3 py-2'>Jugador</th>
                      <th className='px-3 py-2 text-center'>Pts</th>
                      <th className='px-3 py-2 text-center'>W</th>
                      <th className='px-3 py-2 text-center'>D</th>
                      <th className='px-3 py-2 text-center'>L</th>
                      <th className='px-3 py-2 text-right rounded-r-lg'>OMW%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map(p=>(
                      <tr key={p.id} className={`border-b border-white/10 hover:bg-white/5 ${p.rank===1?'bg-amber-500/10':p.rank===2?'bg-slate-400/10':p.rank===3?'bg-yellow-700/10':''}`}>
                        <td className='px-3 py-2.5'>
                          {p.rank <= 3 && <span className={`mr-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${p.rank===1?'bg-amber-500/20 text-amber-300':p.rank===2?'bg-slate-400/20 text-slate-300':p.rank===3?'bg-yellow-700/20 text-yellow-600':''}`}>#{p.rank}</span>}
                          {p.rank > 3 && p.rank}
                        </td>
                        <td className={`px-3 py-2.5 ${p.dropped ? 'line-through text-gray-400' : ''}`}>
                          {p.name}
                          {p.dropped && <span className='ml-2 bg-yellow-500/20 text-yellow-300 text-xs px-1.5 py-0.5 rounded'>Drop</span>}
                        </td>
                        <td className='px-3 py-2.5 text-center font-semibold'>{p.points}</td>
                        <td className='px-3 py-2.5 text-center'>{p.wins}</td>
                        <td className='px-3 py-2.5 text-center'>{p.draws}</td>
                        <td className='px-3 py-2.5 text-center'>{p.losses}</td>
                        <td className='px-3 py-2.5 text-right'>{(p.omw*100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className='mt-3 text-xs text-gray-400'>
                  <span className='inline-block mr-3'>Pts: Puntos</span>
                  <span className='inline-block mr-3'>W: Victorias</span>
                  <span className='inline-block mr-3'>D: Empates</span>
                  <span className='inline-block mr-3'>L: Derrotas</span>
                  <span className='inline-block'>OMW%: Porcentaje de victorias de oponentes</span>
                </div>
              </div>
            }
          </section>
        </main>
        <footer className='text-center text-gray-400 py-8'>
          <div className='flex justify-center items-center gap-3 text-sm mb-2'>
            <div className='px-2 py-1 bg-white/5 rounded-lg'>
              <span className='text-cyan-300 mr-1'>{t.players.length}</span>Jugadores
            </div>
            <div className='px-2 py-1 bg-white/5 rounded-lg'>
              <span className='text-cyan-300 mr-1'>{t.rounds.length}</span>Rondas
            </div>
          </div>
          <div className='text-xs'>
            © {new Date().getFullYear()} CSWO Team - Arena Manager
          </div>
        </footer>
      </div>
    )
  }

  // Organizer UI
  return (
    <div className='min-h-screen text-white'>
      <Background/>
      
      {/* Modal del gestor de plantillas */}
      {showTemplateManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <TemplateManager onClose={() => setShowTemplateManager(false)} />
        </div>
      )}
      <header className='sticky top-0 z-10 backdrop-blur bg-black/40 border-b border-white/10'>
        <div className='max-w-6xl mx-auto px-4 py-4 flex items-center justify-between'>
          <h1 className='text-2xl md:text-3xl font-extrabold neon-title'>COMUNIDAD CSWO</h1>
          <Status label={stateLabel} round={roundCounter} />
        </div>
      </header>
      <main className='max-w-6xl mx-auto px-4 py-6'>
        <section className='card'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <h2 className='text-xl font-bold text-cyan-300'>Arena CSWO Manager</h2>
              <p className='text-gray-300 text-sm'>Somos la comunidad de MYL mas grande de Chile</p>
            </div>
            <div className='flex gap-2'>
              <button className='btn' onClick={genLink}>Generar enlace público</button>
              <button className='btn-ghost' onClick={()=>exportPDF('standings')}>PDF Clasificación</button>
            </div>
          </div>
          <div className='flex flex-wrap gap-2 mt-4'>
            <button className='btn-ghost' title='Administrar plantillas de torneo' onClick={() => setShowTemplateManager(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 inline">
                <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                <path d="M14 3v5h5"/>
                <path d="M9 13h6"/>
                <path d="M9 17h3"/>
              </svg>
              Plantillas
            </button>
            <button className='btn-ghost' onClick={()=>{
              // Mostrar un diálogo para la creación del torneo con plantillas
              const container = document.createElement('div');
              container.innerHTML = `
                <div style="padding: 20px; max-width: 500px; background: rgba(13,17,23,0.95); border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                  <h3 style="margin-top: 0; color: #22d3ee; font-size: 18px;">Crear Nuevo Torneo</h3>
                  
                  <div style="margin-bottom: 15px;">
                    <label style="display: block; color: #e5e7eb; margin-bottom: 5px; font-size: 14px;">Nombre del torneo</label>
                    <input id="tournamentName" style="width: 100%; padding: 8px; border-radius: 5px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);" placeholder="Mi Torneo CSWO" />
                  </div>
                  
                  <div style="margin-bottom: 20px;">
                    <label style="display: block; color: #e5e7eb; margin-bottom: 5px; font-size: 14px;">Plantilla</label>
                    <select id="templateSelector" style="width: 100%; padding: 8px; border-radius: 5px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">
                      <option value="">Plantilla básica</option>
                      ${loadTemplates().map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 5px;">
                      Selecciona una plantilla para aplicar configuración predefinida.
                    </p>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between;">
                    <button id="closeBtn" style="padding: 8px 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 5px;">
                      Cancelar
                    </button>
                    <button id="createBtn" style="padding: 8px 12px; background: #0284c7; color: white; border: none; border-radius: 5px;">
                      Crear Torneo
                    </button>
                  </div>
                </div>
              `;
              
              const modal = document.createElement('div');
              modal.style = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 9999;';
              modal.appendChild(container);
              document.body.appendChild(modal);
              
              document.getElementById('closeBtn').addEventListener('click', () => {
                document.body.removeChild(modal);
              });
              
              document.getElementById('createBtn').addEventListener('click', () => {
                const name = document.getElementById('tournamentName').value || 'Mi Torneo CSWO';
                const templateId = document.getElementById('templateSelector').value || null;
                
                // Crear nuevo torneo con la plantilla seleccionada
                const nt = emptyTournament(name, templateId);
                saveTournament(nt);
                setT(nt);
                document.body.removeChild(modal);
              });
              
              modal.addEventListener('click', e => {
                if (e.target === modal) document.body.removeChild(modal);
              });
            }}>Nuevo torneo</button>
            <button className='btn-ghost' onClick={()=>{
              const tournaments = listTournaments();
              if (tournaments && tournaments.length > 0) {
                const selectHTML = tournaments.map(t => 
                  `<option value="${t.slug}">${t.meta?.name || t.slug} (${new Date(t.updatedAt || 0).toLocaleDateString()})</option>`
                ).join('');
                
                const container = document.createElement('div');
                container.innerHTML = `
                  <div style="padding: 10px; max-width: 300px;">
                    <h3 style="margin-bottom: 10px;">Seleccionar torneo:</h3>
                    <select id="tournamentSelector" style="width: 100%; padding: 5px; margin-bottom: 10px;">
                      ${selectHTML}
                    </select>
                    <div style="display: flex; justify-content: space-between;">
                      <button id="loadBtn" style="padding: 5px 10px; background: #0284c7; color: white; border: none; border-radius: 5px;">Cargar</button>
                      <button id="deleteBtn" style="padding: 5px 10px; background: #ef4444; color: white; border: none; border-radius: 5px;">Eliminar</button>
                    </div>
                  </div>
                `;
                
                const modal = document.createElement('div');
                modal.style = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000;';
                modal.appendChild(container);
                document.body.appendChild(modal);
                
                modal.addEventListener('click', e => {
                  if (e.target === modal) document.body.removeChild(modal);
                });
                
                document.getElementById('loadBtn').addEventListener('click', () => {
                  const select = document.getElementById('tournamentSelector');
                  const slug = select.value;
                  const nt = getTournament(slug);
                  if (nt) {
                    setT(nt);
                    document.body.removeChild(modal);
                  }
                });
                
                document.getElementById('deleteBtn').addEventListener('click', () => {
                  const select = document.getElementById('tournamentSelector');
                  const slug = select.value;
                  if (confirm(`¿Seguro que deseas eliminar el torneo "${select.options[select.selectedIndex].text}"?`)) {
                    deleteTournament(slug);
                    document.body.removeChild(modal);
                  }
                });
              } else {
                alert('No hay torneos guardados.');
              }
            }}>Cargar torneo</button>
          </div>
          <div className='grid md:grid-cols-3 gap-3 mt-4'>
            <div>
              <label className='text-sm text-gray-400'>Nombre del torneo</label>
              <input className='input' value={t.meta.name} onChange={e=> setT({...t, meta:{...t.meta, name:e.target.value}, slug:slugify(e.target.value)}) } />
            </div>
            <div>
              <label className='text-sm text-gray-400'>Fecha</label>
              <input type='date' className='input' value={t.meta.date} onChange={e=> setT({...t, meta:{...t.meta, date:e.target.value}}) } />
            </div>
            <div>
              <label className='text-sm text-gray-400'>Rondas máximas</label>
              <input type='number' min={1} className='input' value={t.meta.maxRounds} onChange={e=> setT({...t, meta:{...t.meta, maxRounds: Math.max(1, parseInt(e.target.value||1))}}) } />
            </div>
          </div>
        </section>

        <section className='card mt-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-cyan-300'>Jugadores ({t.players.length})</h3>
            <div className='flex gap-2'>
              <label className='btn-ghost cursor-pointer'>Importar CSV
                <input type='file' accept='.csv,.txt' className='hidden' onChange={e=>{ const f=e.target.files?.[0]; if(f) f.text().then(txt=>bulkTextAdd(txt)) }}/>
              </label>
              <button className='btn-ghost' onClick={()=>{
                const data = JSON.stringify(t,null,2)
                const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:'application/json'})); a.download=`${t.slug}.json`; a.click(); URL.revokeObjectURL(a.href)
              }}>Exportar JSON</button>
              <label className='btn-ghost cursor-pointer'>Importar JSON
                <input type='file' accept='application/json' className='hidden' onChange={async e=>{
                  const f=e.target.files?.[0]; if(!f) return; const txt=await f.text(); try{ const obj=JSON.parse(txt); setT(obj) } catch{ alert('JSON inválido') }
                }}/>
              </label>
            </div>
          </div>
          <div className='flex gap-2 mt-3'>
            <input className='input flex-1' placeholder='Nombre del jugador' onKeyDown={e=>{ if(e.key==='Enter'){ addPlayer(e.currentTarget.value); e.currentTarget.value='' } }} />
            <button className='btn' onClick={()=>{ const inp=document.querySelector('input[placeholder=\"Nombre del jugador\"]'); addPlayer(inp?.value||''); if(inp) inp.value='' }}>Añadir</button>
          </div>
          <details className='mt-3'>
            <summary className='cursor-pointer select-none text-sm text-gray-300'>📋 Carga masiva (pega una lista y pulsa “Agregar todo”)</summary>
            <textarea className='input mt-2 min-h-[120px]' id='bulkArea' placeholder='Una por línea, o separadas por coma'></textarea>
            <button className='btn mt-2' onClick={()=>{ const ta=document.getElementById('bulkArea'); if(ta) { bulkTextAdd(ta.value); ta.value='' } }}>Agregar todo</button>
          </details>
          <ul className='mt-4 grid md:grid-cols-2 gap-2'>
            {t.players.map(p=>(
              <li key={p.id} className='bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between'>
                <span className={p.dropped ? 'line-through text-gray-400' : ''}>{p.name}</span>
                <div className='flex gap-2'>
                  <button className={`text-sm ${p.dropped ? 'text-green-300' : 'text-yellow-300'} hover:underline`} 
                          onClick={()=> {
                            // Actualizar el estado de drop del jugador
                            const newDroppedState = !p.dropped;
                            const updatedPlayers = t.players.map(x => x.id === p.id ? {...x, dropped: newDroppedState} : x);
                            
                            // Si el jugador ahora está en estado drop, actualizar automáticamente todos sus emparejamientos actuales
                            let updatedRounds = [...t.rounds];
                            
                            // Solo actualizamos la última ronda si está en progreso
                            const currentRound = t.rounds[t.rounds.length - 1];
                            if (currentRound && !t.finished) {
                              const updatedPairings = currentRound.pairings.map(m => {
                                // Si este emparejamiento involucra al jugador y no tiene resultado
                                if ((m.p1 === p.id || m.p2 === p.id) && !m.result) {
                                  if (m.p1 === p.id && m.p2) {
                                    // Jugador 1 en drop, jugador 2 gana
                                    return newDroppedState ? 
                                      { ...m, result: 'P2', p1Wins: 0, p2Wins: 2 } : 
                                      m;
                                  } else if (m.p2 === p.id) {
                                    // Jugador 2 en drop, jugador 1 gana
                                    return newDroppedState ? 
                                      { ...m, result: 'P1', p1Wins: 2, p2Wins: 0 } : 
                                      m;
                                  }
                                }
                                return m;
                              });
                              
                              updatedRounds[updatedRounds.length - 1] = {
                                ...currentRound,
                                pairings: updatedPairings
                              };
                            }
                            
                            setT({...t, players: updatedPlayers, rounds: updatedRounds});
                          }}
                  >
                    {p.dropped ? 'Reintegrar' : 'Drop'}
                  </button>
                  <button className='text-sm text-red-300 hover:underline' onClick={()=> setT({...t, players:t.players.filter(x=>x.id!==p.id)})}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className='card mt-4'>
          <div className='flex items-center justify-between gap-2'>
            <h3 className='text-lg font-semibold text-cyan-300'>Torneo</h3>
            <div className='flex gap-2'>
              <button className='btn' onClick={startRound}>Nueva ronda</button>
              <button className='btn-ghost' onClick={()=>exportPDF('rounds')}>PDF Rondas</button>
              {!t.finished && <button className='btn-ghost' onClick={finish}>Finalizar torneo</button>}
            </div>
          </div>
          {t.rounds.length===0 && <p className='text-gray-400 mt-2'>Aún no hay rondas.</p>}
          {t.rounds.map(r=>(
            <div key={r.number} className='mt-4'>
              <div className='flex items-center justify-between mb-2'>
                <h4 className='text-cyan-300 font-semibold'>Ronda {r.number}</h4>
                {r.number === t.rounds.length && !t.finished && (
                  <button 
                    className='text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 px-2 py-1 rounded transition-colors flex items-center gap-1' 
                    onClick={() => deleteRound(r.number)}
                    title='Eliminar esta ronda'
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                    Eliminar ronda
                  </button>
                )}
              </div>
              {r.pairings.map(m=>{
                const p1=byId[m.p1]?.name||'??'; const p2=m.p2? (byId[m.p2]?.name||'??') : 'BYE'
                const dis = !m.p2
                return (
                  <div key={m.id} className='grid md:grid-cols-12 gap-2 items-center border-b border-white/10 py-2'>
                    <div className='md:col-span-4'><span className='text-xs text-gray-400 mr-2'>Mesa {m.table}</span>{p1} vs {p2}</div>
                    <div className='md:col-span-6 grid grid-cols-2 gap-2'>
                      <div className='flex items-center gap-2'><span className='text-sm text-gray-400'>A</span>
                        <input type='number' min={0} max={3} disabled={dis} className='input' value={m.p1Wins||0} onChange={e=> updateScore(r.number,m.id,'p1Wins',e.target.value) }/></div>
                      <div className='flex items-center gap-2'><span className='text-sm text-gray-400'>B</span>
                        <input type='number' min={0} max={3} disabled={dis} className='input' value={m.p2Wins||0} onChange={e=> updateScore(r.number,m.id,'p2Wins',e.target.value) }/></div>
                    </div>
                    <div className='md:col-span-2 flex items-center gap-2'>
                      <button className='btn' disabled={dis} onClick={()=> saveResult(r.number,m.id) }>Guardar</button>
                      {m.result && <span className='text-xs text-gray-300'>{m.result==='P1'?'Gana A':m.result==='P2'?'Gana B':'Empate'}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </section>

        <section className='card mt-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-cyan-300'>Clasificación</h3>
            <div className='text-sm text-cyan-200/90'><Status label={stateLabel} round={roundCounter} /></div>
          </div>
          {standings.length===0? <p className='text-gray-400 mt-2'>Sin datos aún.</p> :
            <table className='w-full text-left border-collapse mt-2'>
              <thead><tr className='table-head'><th>#</th><th>Jugador</th><th>Pts</th><th>W</th><th>D</th><th>L</th><th>OMW%</th></tr></thead>
              <tbody>{standings.map(p=>(
                <tr key={p.id} className={`border-b border-white/10 ${p.rank<=3?'bg-cyan-500/10':''}`}>
                  <td>{p.rank}</td><td className={p.dropped ? 'line-through text-gray-400' : ''}>{p.name}{p.dropped ? ' (Drop)' : ''}</td><td>{p.points}</td><td>{p.wins}</td><td>{p.draws}</td><td>{p.losses}</td><td>{(p.omw*100).toFixed(1)}</td>
                </tr>
              ))}</tbody>
            </table>
          }
        </section>
      </main>
      <footer className='text-center text-xs text-gray-400 py-8'>By CSWO Team</footer>
    </div>
  )
}

function Status({label, round}){
  const color = label==='FINALIZADO' ? 'bg-red-600/30 border-red-400/50' : label==='RONDA EN PROGRESO' ? 'bg-yellow-500/20 border-yellow-400/50' : 'bg-cyan-600/20 border-cyan-400/50'
  const dot = label==='FINALIZADO' ? 'bg-red-400' : label==='RONDA EN PROGRESO' ? 'bg-yellow-300' : 'bg-cyan-300'
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${color}`}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${dot}`} />
      <span className='uppercase tracking-wide text-xs'>{label}</span>
      <span className='text-xs text-gray-300'>• Ronda {round}</span>
    </div>
  )
}

