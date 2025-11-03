// Gestión de plantillas de torneos para diferentes formatos
// Permite guardar y cargar configuraciones predefinidas

const TEMPLATE_STORAGE_KEY = 'cswo_tournament_templates_v1';

// Plantillas predeterminadas del sistema
const DEFAULT_TEMPLATES = [
  {
    id: 'swiss_standard',
    name: 'Swiss Standard',
    description: 'Torneo suizo estándar (3 puntos victoria, 1 punto empate)',
    system: 'swiss',
    editable: false, // Las plantillas por defecto no se pueden editar
    config: {
      maxRounds: 5,
      pointsSystem: { WIN: 3, DRAW: 1, LOSS: 0, BYE: 3 },
      tiebreakers: ['points', 'omw', 'wins', 'name'],
      drawAllowed: true
    }
  },
  {
    id: 'myl_championship',
    name: 'Campeonato MYL',
    description: 'Formato oficial para torneos de MYL (3-1-0)',
    system: 'swiss',
    editable: false,
    config: {
      maxRounds: 6,
      pointsSystem: { WIN: 3, DRAW: 1, LOSS: 0, BYE: 3 },
      tiebreakers: ['points', 'omw', 'wins', 'name'],
      drawAllowed: true
    }
  },
  {
    id: 'elimination',
    name: 'Eliminación Directa',
    description: 'Torneo de eliminación simple (sin empates)',
    system: 'elimination',
    editable: false,
    config: {
      maxRounds: 'auto', // Se calcula automáticamente según el número de jugadores
      pointsSystem: { WIN: 1, DRAW: 0, LOSS: 0, BYE: 1 },
      tiebreakers: ['wins'],
      drawAllowed: false
    }
  }
];

// Carga todas las plantillas (predeterminadas + personalizadas)
export function loadTemplates() {
  try {
    // Cargar plantillas personalizadas del localStorage
    const storedTemplates = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || '[]');
    
    // Combinar con las plantillas predeterminadas
    return [...DEFAULT_TEMPLATES, ...storedTemplates];
  } catch (error) {
    console.error('Error loading tournament templates:', error);
    return DEFAULT_TEMPLATES;
  }
}

// Guarda una nueva plantilla personalizada
export function saveTemplate(template) {
  try {
    // No permitir sobrescribir plantillas predeterminadas
    if (DEFAULT_TEMPLATES.some(t => t.id === template.id)) {
      throw new Error('Cannot modify default templates');
    }
    
    // Generar ID si es una plantilla nueva
    if (!template.id) {
      template.id = 'template_' + Date.now().toString(36);
    }
    
    // Marcar como editable (plantilla personalizada)
    template.editable = true;
    
    // Obtener plantillas existentes y agregar/actualizar la nueva
    const existingTemplates = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || '[]');
    const updatedTemplates = existingTemplates.filter(t => t.id !== template.id);
    updatedTemplates.push(template);
    
    // Guardar en localStorage
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updatedTemplates));
    return template;
  } catch (error) {
    console.error('Error saving tournament template:', error);
    throw error;
  }
}

// Elimina una plantilla personalizada
export function deleteTemplate(templateId) {
  try {
    // No permitir eliminar plantillas predeterminadas
    if (DEFAULT_TEMPLATES.some(t => t.id === templateId)) {
      throw new Error('Cannot delete default templates');
    }
    
    // Obtener plantillas existentes y eliminar la especificada
    const existingTemplates = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || '[]');
    const updatedTemplates = existingTemplates.filter(t => t.id !== templateId);
    
    // Guardar en localStorage
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updatedTemplates));
    return true;
  } catch (error) {
    console.error('Error deleting tournament template:', error);
    throw error;
  }
}

// Obtiene una plantilla específica por ID
export function getTemplate(templateId) {
  const allTemplates = loadTemplates();
  return allTemplates.find(t => t.id === templateId) || null;
}

// Crea un torneo vacío basado en una plantilla
export function createTournamentFromTemplate(templateId, tournamentName) {
  // Obtener la plantilla
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template with ID ${templateId} not found`);
  }
  
  // Aquí se implementaría la lógica para generar un torneo basado en la plantilla
  // Por ahora, regresamos un objeto base que luego se puede integrar con la función emptyTournament
  return {
    templateId: template.id,
    templateName: template.name,
    system: template.system,
    config: { ...template.config }
  };
}
