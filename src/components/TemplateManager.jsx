import React, { useState, useEffect } from 'react';
import { loadTemplates, saveTemplate, deleteTemplate } from './TournamentTemplates';

/**
 * Componente para gestionar las plantillas de torneos existentes
 */
export default function TemplateManager({ onClose }) {
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
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

  // Iniciar edición de una plantilla existente
  const handleEditTemplate = (template) => {
    setEditingTemplate(template.id);
    setNewTemplate({
      ...template,
      // Si la plantilla no es editable (predefinida), creamos una copia
      id: template.editable ? template.id : null
    });
  };

  // Guardar una plantilla nueva o editada
  const handleSaveTemplate = () => {
    if (!newTemplate.name.trim()) {
      alert('Por favor ingresa un nombre para la plantilla');
      return;
    }
    
    try {
      const savedTemplate = saveTemplate(newTemplate);
      
      // Actualizar la lista de plantillas
      setTemplates(loadTemplates());
      
      // Reiniciar el formulario
      setEditingTemplate(null);
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

  // Eliminar una plantilla
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

  return (
    <div className="p-6 bg-gray-900 rounded-xl border border-white/10 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-cyan-300">Administrar Plantillas de Torneo</h2>
        <button
          className="text-gray-400 hover:text-white"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Formulario de edición/creación */}
      {editingTemplate !== null && (
        <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-lg font-semibold text-cyan-300 mb-4">
            {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
              <label className="block text-sm text-gray-300 mb-1">Sistema</label>
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
          </div>
          
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">Descripción</label>
            <textarea
              className="input w-full"
              value={newTemplate.description}
              onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
              placeholder="Describe las reglas específicas de este formato..."
              rows={2}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            
            <div>
              <label className="block text-sm text-gray-300 mb-1">Puntos por victoria</label>
              <input
                type="number"
                className="input w-full"
                min={1}
                max={10}
                value={newTemplate.config.pointsSystem.WIN}
                onChange={e => setNewTemplate({
                  ...newTemplate,
                  config: {
                    ...newTemplate.config,
                    pointsSystem: {
                      ...newTemplate.config.pointsSystem,
                      WIN: parseInt(e.target.value || '3')
                    }
                  }
                })}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-1">Puntos por empate</label>
              <input
                type="number"
                className="input w-full"
                min={0}
                max={10}
                value={newTemplate.config.pointsSystem.DRAW}
                onChange={e => setNewTemplate({
                  ...newTemplate,
                  config: {
                    ...newTemplate.config,
                    pointsSystem: {
                      ...newTemplate.config.pointsSystem,
                      DRAW: parseInt(e.target.value || '1')
                    }
                  }
                })}
              />
            </div>
          </div>
          
          <div className="flex items-center mt-4">
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
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              className="btn-ghost"
              onClick={() => {
                setEditingTemplate(null);
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
              }}
            >
              Cancelar
            </button>
            <button className="btn" onClick={handleSaveTemplate}>
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Lista de plantillas */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Plantillas disponibles</h3>
          {editingTemplate === null && (
            <button
              className="btn-ghost text-sm"
              onClick={() => setEditingTemplate('')}
            >
              + Nueva plantilla
            </button>
          )}
        </div>
        
        {templates.map(template => (
          <div
            key={template.id}
            className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-white flex items-center gap-2">
                  {template.name}
                  {!template.editable && (
                    <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">
                      Predefinida
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-300 mt-1">{template.description}</p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditTemplate(template)}
                  className="text-cyan-400 hover:text-cyan-300"
                  title={template.editable ? "Editar plantilla" : "Copiar plantilla"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {template.editable ? (
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    ) : (
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    )}
                    {template.editable ? (
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    ) : (
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    )}
                  </svg>
                </button>
                
                {template.editable && (
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
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
            </div>
            
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                {template.system === 'swiss' ? 'Suizo' : 
                 template.system === 'elimination' ? 'Eliminación Directa' : 'Round Robin'}
              </span>
              <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                {template.config.maxRounds} rondas
              </span>
              <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                Victoria: {template.config.pointsSystem?.WIN || 3} pts
              </span>
              <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                Empate: {template.config.pointsSystem?.DRAW || 1} pts
              </span>
              {template.config.drawAllowed && (
                <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">
                  Empates permitidos
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
