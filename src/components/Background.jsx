import React from 'react'
export default function Background(){
  return (
    <div className='fixed inset-0 -z-10 overflow-hidden' aria-hidden>
      {/* Fondo principal unificado */}
      <div className='absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0a0f24] to-black' />
      
      {/* Único resplandor grande central que cubre toda la pantalla */}
      <div 
        className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vh] bg-[rgba(0,191,255,0.12)] rounded-full blur-[180px]'
        style={{
          animation: 'pulse 15s ease-in-out infinite'
        }}
      />
      
      {/* Estrellas y puntos de luz dispersos */}
      {Array.from({length:24}).map((_,i)=>(
        <span 
          key={i} 
          className='pointer-events-none absolute w-1 h-1 bg-cyan-300/70 rounded-full'
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            filter: 'blur(.2px)',
            animation: 'float 14s ease-in-out infinite',
            animationDelay: `${-i*0.5}s`
          }}
        />
      ))}
    </div>
  )
}
