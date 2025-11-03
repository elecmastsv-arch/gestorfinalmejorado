import React, { useEffect, useState } from 'react';
import App from './App.jsx';
import Login from './components/Login.jsx';
import { getTournament, listTournaments, saveTournament } from './components/Storage';

function LogoutButton({ onLogout }) {
  return (
    <button
      onClick={onLogout}
      className="fixed top-3 right-3 z-50 rounded-xl bg-red-500/90 hover:bg-red-400 text-white text-sm px-3 py-2 shadow-lg"
      title="Cerrar sesión de administrador"
    >
      Cerrar sesión
    </button>
  );
}

/**
 * Envoltura que protege toda la app detrás de un login de admin.
 * Persiste estado en localStorage (adminAuth=true).
 */
export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);

  useEffect(() => {
    try {
      setAuthed(localStorage.getItem('adminAuth') === 'true');
      
      // Si ya hay un torneo en localStorage, lo cargamos directamente
      const lastTournamentSlug = localStorage.getItem('lastTournamentSlug');
      if (lastTournamentSlug) {
        const tournament = getTournament(lastTournamentSlug);
        if (tournament) {
          setSelectedTournament(tournament);
          return;
        }
      }
      
      // Si no hay torneo guardado o no se encuentra, creamos uno nuevo o usamos el primero de la lista
      const tournaments = listTournaments();
      if (tournaments && tournaments.length > 0) {
        // Usar el torneo más reciente según updatedAt
        const mostRecentTournament = tournaments.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        setSelectedTournament(getTournament(mostRecentTournament.slug));
        localStorage.setItem('lastTournamentSlug', mostRecentTournament.slug);
      }
    } catch {
      setAuthed(false);
    }
  }, []);

  const handleSuccess = () => setAuthed(true);
  const handleLogout = () => {
    try { localStorage.removeItem('adminAuth'); } catch {}
    setAuthed(false);
  };

  if (!authed) return <Login onSuccess={handleSuccess} />;

  return (
    <>
      <LogoutButton onLogout={handleLogout} />
      <App initialTournament={selectedTournament} onTournamentChange={(tournament) => {
        setSelectedTournament(tournament);
        if (tournament && tournament.slug) {
          localStorage.setItem('lastTournamentSlug', tournament.slug);
        }
      }} />
    </>
  );
}