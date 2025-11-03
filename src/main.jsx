import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminApp from './AdminApp.jsx'
import App from './App.jsx'
import { getTournament, saveTournament } from './components/Storage.js'

// Componente para importar datos externos
const ImportDataScreen = ({ onDataLoaded }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setError('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.slug || !data.meta || !data.players) {
          throw new Error('Archivo de torneo inválido');
        }
        // Guardar el torneo importado en localStorage
        saveTournament(data);
        onDataLoaded(data);
      } catch (err) {
        setError('Error al procesar el archivo: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Error al leer el archivo');
      setIsLoading(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="bg-gray-800 p-8 rounded-xl border border-white/10 shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-cyan-300 mb-6 text-center">Arena CSWO Manager</h1>
        
        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded mb-4">{error}</div>}
        
        <div className="space-y-6">
          <div>
            <h2 className="text-white text-lg mb-2">Importar torneo desde archivo</h2>
            <p className="text-gray-300 text-sm mb-4">Selecciona un archivo JSON con los datos del torneo</p>
            
            <label className="block w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded cursor-pointer text-center">
              {isLoading ? "Procesando..." : "Seleccionar archivo JSON"}
              <input 
                type="file" 
                accept=".json,application/json" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isLoading}
              />
            </label>
          </div>
          
          <div className="border-t border-white/10 pt-6">
            <p className="text-white text-sm mb-3">¿Ya tienes un enlace de acceso?</p>
            <a href="/" className="block w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded text-center">
              Volver al inicio
            </a>
          </div>
        </div>
        
        <p className="text-gray-400 text-xs text-center mt-6">
          © {new Date().getFullYear()} CSWO Team — Arena Manager
        </p>
      </div>
    </div>
  );
};

// Determinar si estamos en modo visor basado en los parámetros de la URL
const urlParams = new URLSearchParams(window.location.search)
const isViewMode = urlParams.has('view') || urlParams.get('mode') === 'view'
const tournamentSlug = urlParams.get('t')
const hasDataParam = urlParams.has('data')

// Componente raíz que decide qué mostrar
const Root = () => {
  const [importedData, setImportedData] = useState(null);
  const [isImportMode, setIsImportMode] = useState(!!urlParams.get('import'));

  // Si estamos en modo importación, mostrar pantalla de importación
  if (isImportMode) {
    return <ImportDataScreen onDataLoaded={(data) => {
      setImportedData(data);
      setIsImportMode(false);
      // Redirigir a la vista del torneo recién importado
      window.location.href = `?t=${data.slug}&view=1`;
    }} />;
  }
  
  // Si estamos en modo visor y hay un slug de torneo, mostramos la vista pública
  if (isViewMode && tournamentSlug) {
    return <App initialViewMode={true} viewSlug={tournamentSlug} />;
  } 
  
  // Por defecto, mostramos la aplicación de administrador
  return <AdminApp />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
