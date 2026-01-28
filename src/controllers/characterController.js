import Character from '../models/Character.js';
import User from '../models/User.js';

// @desc    Obtener todos los personajes del usuario
// @route   GET /api/characters
// @access  Private
export const getCharacters = async (req, res) => {
  try {
    const characters = await Character.find({ userId: req.user.userId })
      .select('-__v')
      .sort({ lastPlayed: -1 });

    res.json({
      success: true,
      count: characters.length,
      data: characters
    });
  } catch (error) {
    console.error('Error al obtener personajes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener personajes'
    });
  }
};

// @desc    Obtener un personaje específico
// @route   GET /api/characters/:id
// @access  Private
export const getCharacter = async (req, res) => {
  try {
    const character = await Character.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    res.json({
      success: true,
      data: character
    });
  } catch (error) {
    console.error('Error al obtener personaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener personaje'
    });
  }
};

// @desc    Crear nuevo personaje
// @route   POST /api/characters
// @access  Private
export const createCharacter = async (req, res) => {
  try {
    const { name, class: charClass, appearance } = req.body;

    // Validar campos obligatorios
    if (!name || !charClass) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y clase son obligatorios'
      });
    }

    // Verificar límite de personajes por cuenta (máximo 3)
    const characterCount = await Character.countDocuments({ userId: req.user.userId });
    if (characterCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Has alcanzado el límite de 3 personajes por cuenta'
      });
    }

    // Verificar que el nombre no esté en uso
    const nameExists = await Character.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Este nombre de personaje ya está en uso'
      });
    }

    // Calcular stats iniciales según clase
    const classStats = {
      guerrero: {
        strength: 20,
        dexterity: 15,
        intelligence: 12,
        constitution: 20,
        charisma: 14,
        maxHp: 120,
        maxMana: 40,
        minDamage: 2,
        maxDamage: 5
      },
      mago: {
        strength: 12,
        dexterity: 14,
        intelligence: 22,
        constitution: 13,
        charisma: 16,
        maxHp: 80,
        maxMana: 120,
        minDamage: 1,
        maxDamage: 3
      },
      arquero: {
        strength: 14,
        dexterity: 22,
        intelligence: 14,
        constitution: 16,
        charisma: 15,
        maxHp: 100,
        maxMana: 60,
        minDamage: 2,
        maxDamage: 4
      },
      clerigo: {
        strength: 14,
        dexterity: 13,
        intelligence: 18,
        constitution: 16,
        charisma: 20,
        maxHp: 100,
        maxMana: 100,
        minDamage: 1,
        maxDamage: 4
      },
      asesino: {
        strength: 16,
        dexterity: 22,
        intelligence: 14,
        constitution: 14,
        charisma: 13,
        maxHp: 90,
        maxMana: 50,
        minDamage: 2,
        maxDamage: 6
      },
      paladin: {
        strength: 18,
        dexterity: 14,
        intelligence: 14,
        constitution: 20,
        charisma: 18,
        maxHp: 115,
        maxMana: 70,
        minDamage: 2,
        maxDamage: 5
      },
      bardo: {
        strength: 13,
        dexterity: 16,
        intelligence: 16,
        constitution: 14,
        charisma: 22,
        maxHp: 95,
        maxMana: 85,
        minDamage: 1,
        maxDamage: 4
      }
    };

    const stats = classStats[charClass] || classStats.guerrero;

    // Crear personaje
    const character = await Character.create({
      userId: req.user.userId,
      name,
      class: charClass,
      appearance: appearance || {},
      stats: {
        ...stats,
        hp: stats.maxHp,
        mana: stats.maxMana,
        stamina: 100,
        maxStamina: 100,
        level: 1,
        experience: 0,
        gold: 100,
        defense: 0,
        magicDefense: 0,
        evasion: 0,
        accuracy: 50
      },
      // Inventario inicial con algunas pociones
      inventory: [
        { slot: 1, itemId: 'potion_health_minor', quantity: 5 },
        { slot: 2, itemId: 'potion_mana_minor', quantity: 3 }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Personaje creado exitosamente',
      data: character
    });
  } catch (error) {
    console.error('Error al crear personaje:', error);

    // Manejo de errores de validación
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || 'Error de validación'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear personaje'
    });
  }
};

// @desc    Actualizar personaje
// @route   PUT /api/characters/:id
// @access  Private
export const updateCharacter = async (req, res) => {
  try {
    const character = await Character.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    // No permitir cambiar ciertos campos críticos
    const allowedUpdates = ['position', 'stats', 'inventory', 'equipment', 'spells', 'state', 'lastPlayed'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    Object.assign(character, updates);
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

// @desc    Eliminar personaje
// @route   DELETE /api/characters/:id
// @access  Private
export const deleteCharacter = async (req, res) => {
  try {
    const character = await Character.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    // No permitir eliminar personajes online
    if (character.state.isOnline) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar un personaje que está conectado'
      });
    }

    await Character.deleteOne({ _id: character._id });

    res.json({
      success: true,
      message: 'Personaje eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar personaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar personaje'
    });
  }
};

// @desc    Seleccionar personaje para jugar
// @route   POST /api/characters/:id/select
// @access  Private
export const selectCharacter = async (req, res) => {
  try {
    const character = await Character.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    // Verificar que el personaje no esté ya conectado
    if (character.state.isOnline) {
      return res.status(400).json({
        success: false,
        message: 'Este personaje ya está conectado'
      });
    }

    // Marcar como online y actualizar última jugada
    character.state.isOnline = true;
    character.lastPlayed = new Date();
    await character.save();

    res.json({
      success: true,
      message: 'Personaje seleccionado exitosamente',
      data: character
    });
  } catch (error) {
    console.error('Error al seleccionar personaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al seleccionar personaje'
    });
  }
};

// @desc    Desconectar personaje
// @route   POST /api/characters/:id/disconnect
// @access  Private
export const disconnectCharacter = async (req, res) => {
  try {
    const character = await Character.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    // Guardar estado y marcar como offline
    character.state.isOnline = false;
    character.state.isMeditating = false;
    character.lastPlayed = new Date();
    
    // Guardar posición final si se proporciona
    if (req.body.position) {
      character.position = req.body.position;
    }
    
    // Guardar stats finales si se proporcionan
    if (req.body.stats) {
      Object.assign(character.stats, req.body.stats);
    }

    await character.save();

    res.json({
      success: true,
      message: 'Personaje desconectado exitosamente'
    });
  } catch (error) {
    console.error('Error al desconectar personaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desconectar personaje'
    });
  }
};

// @desc    Verificar disponibilidad de nombre
// @route   GET /api/characters/check-name/:name
// @access  Private
export const checkNameAvailability = async (req, res) => {
  try {
    const { name } = req.params;

    const exists = await Character.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    res.json({
      success: true,
      available: !exists
    });
  } catch (error) {
    console.error('Error al verificar nombre:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar nombre'
    });
  }
};