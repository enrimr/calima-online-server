import Character from '../models/Character.js';

// Aquí irían otras funciones del controlador...
// Solo añadiré la función de actualización admin al final del archivo existente

/**
 * Actualizar personaje (solo admin) - para panel de administración
 * PUT /api/admin/characters/:characterId
 */
export const adminUpdateCharacter = async (req, res) => {
  try {
    const { characterId } = req.params;
    const updates = req.body;

    const character = await Character.findById(characterId);
    
    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    // Actualizar stats si se proporcionan
    if (updates.stats) {
      Object.assign(character.stats, updates.stats);
    }

    // Actualizar estado
    if (updates.state) {
      Object.assign(character.state, updates.state);
    }

    // Actualizar apariencia
    if (updates.appearance) {
      Object.assign(character.appearance, updates.appearance);
    }

    // Actualizar posición
    if (updates.position) {
      character.position = updates.position;
    }

    // Actualizar facción
    if (updates.faction) {
      character.faction = updates.faction;
    }

    // Actualizar criminalidad
    if (updates.criminalStatus !== undefined) {
      character.criminalStatus = updates.criminalStatus;
    }

    await character.save();

    res.json({
      success: true,
      message: 'Personaje actualizado exitosamente',
      data: character
    });

  } catch (error) {
    console.error('Error al actualizar personaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar personaje'
    });
  }
};