import React, { useState, useEffect } from 'react';
import { loadTemplates, saveTemplate, deleteTemplate } from './TournamentTemplates';

/**
 * Componente para seleccionar una plantilla de torneo existente 
 * o crear una nueva plantilla personalizada
 */
export default function TemplateSelector({ onSelect, onCancel }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    system: 'swiss',
    config: {
      maxRounds: 5,
      pointsSystem: { WIN: 3, DRAW: 1, LOSS: 0, BYE: 3 },
      drawAllowed: true
    }
  });

  // Cargar plantillas al iniciar
  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  // Manejar la creación de una nueva plantilla
  const handleCreateTemplate = () => {
    if (!newTemplate.name.trim()) {
      alert('Por favor ingresa un nombre para la plantilla');
      return;
    }
    
    try {
      const savedTemplate = saveTemplate(newTemplate);
      setTemplates([...templates.filter(t => t.id !== savedTemplate.id), savedTemplate]);
      setIsCreating(false);
      setNewTemplate({
        name: '',
        description: '',
        system: 'swiss',
        config: {
          maxRounds: 5,
          pointsSystem: { WIN: 3, DRAW: 1, LOSS: 0, BYE: 3 },
          drawAllowed: true
        }
      });
    } catch (error) {
      alert('Error al guardar la plantilla: ' + error.message);
    }
  };

  // Manejar la eliminación de una plantilla
  const handleDeleteTemplate = (templateId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) {
      return;
    }
    
    try {
      deleteTemplate(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (error) {
      alert('Error al eliminar la plantilla: ' + error.message);
    }
  };

  // Interfaz para crear una nueva plantilla
  const renderTemplateCreator = () => (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 mt-4">
      <h3 className="text-lg font-semibold text-cyan-300 mb-4">Nueva Plantilla</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Nombre</label>
          <input 
            type="text" 
            className="input w-full" 
            value={newTemplate.name}
            onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
            placeholder="Ej: Campeonato Regional MYL"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-300 mb-1">Descripción</label>
          <textarea 
            className="input w-full" 
            value={newTemplate.description}
            onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
            placeholder="Describe las reglas específicas de este formato..."
            rows={2}
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-300 mb-1">Sistema de torneo</label>
          <select 
            className="input w-full" 
            value={newTemplate.system}
            onChange={e => setNewTemplate({...newTemplate, system: e.target.value})}
          >
            <option value="swiss">Suizo</option>
            <option value="elimination">Eliminación Directa</option>
            <option value="roundrobin">Round Robin</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-gray-300 mb-1">Rondas máximas</label>
          <input 
            type="number" 
            className="input w-full" 
            min={1}
            max={20}
            value={newTemplate.config.maxRounds}
            onChange={e => setNewTemplate({
              ...newTemplate, 
              config: {
                ...newTemplate.config,
                maxRounds: parseInt(e.target.value || '5')
              }
            })}
          />
        </div>
        
        <div className="flex items-center">
          <input 
            type="checkbox" 
            id="drawAllowed"
            className="mr-2" 
            checked={newTemplate.config.drawAllowed}
            onChange={e => setNewTemplate({
              ...newTemplate, 
              config: {
                ...newTemplate.config,
                drawAllowed: e.target.checked
              }
            })}
          />
          <label htmlFor="drawAllowed" className="text-sm text-gray-300">Permitir empates</label>
        </div>
        
        <div className="pt-2 grid grid-cols-2 gap-2">
          <button 
            className="btn-ghost" 
            onClick={() => setIsCreating(false)}
          >
            Cancelar
          </button>
          <button 
            className="btn" 
            onClick={handleCreateTemplate}
          >
            Guardar Plantilla
          </button>
        </div>
      </div>
    </div>
  );

  // Interfaz principal del selector
  return (
    <div>
      <h2 className="text-xl font-bold text-cyan-300 mb-4">Seleccionar Plantilla de Torneo</h2>
      
      <div className="grid gap-3">
        {templates.map(template => (
          <div 
            key={template.id} 
            className={`p-4 bg-white/5 border rounded-xl transition-all cursor-pointer hover:bg-white/10 ${selectedTemplate === template.id ? 'border-cyan-400 bg-cyan-900/20' : 'border-white/10'}`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-white">{template.name}</h3>
                <p className="text-sm text-gray-300 mt-1">{template.description}</p>
              </div>
              {template.editable && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template.id);
                  }}
                  className="text-red-400 hover:text-red-300"
                  title="Eliminar plantilla"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">{template.system === 'swiss' ? 'Suizo' : template.system === 'elimination' ? 'Eliminación' : 'Round Robin'}</span>
              <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">{template.config.maxRounds} rondas</span>
              {template.config.drawAllowed && 
                <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">Empates permitidos</span>
              }
            </div>
          </div>
        ))}
      </div>
      
      {isCreating ? (
        renderTemplateCreator()
      ) : (
        <div className="flex justify-between mt-6">
          <button 
            className="btn-ghost" 
            onClick={() => setIsCreating(true)}
          >
            Nueva Plantilla
          </button>
          
          <div className="space-x-3">
            <button 
              className="btn-ghost" 
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button 
              className="btn" 
              disabled={!selectedTemplate} 
              onClick={() => onSelect(selectedTemplate)}
            >
              Seleccionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
