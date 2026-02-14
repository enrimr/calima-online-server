/**
 * Tabla de Experiencia de Calima Online
 * Basada en Argentum Online pero con una escala más moderna y accesible
 * 
 * Características:
 * - Niveles iniciales más rápidos (mejor retención de jugadores)
 * - Curva exponencial suave en niveles bajos
 * - Progresión más lineal en niveles altos
 * - Máximo nivel: 50 (vs 47 de AO)
 */

export const EXPERIENCE_TABLE = {
  1: 0,
  2: 100,        // AO: 300 - Más rápido para empezar
  3: 250,        // AO: 900 - Más accesible
  4: 500,        // AO: 2700 - Reducido
  5: 900,        // AO: 8100 - Más suave
  6: 1500,       // AO: 24300 - Mucho más accesible
  7: 2300,       // AO: 48600 - Progresión equilibrada
  8: 3400,       // AO: 73000 - Reducido
  9: 4800,       // AO: 121000 - Más alcanzable
  10: 6500,      // AO: 170000 - Milestone importante
  11: 8500,      // AO: 280000 - Progresión moderada
  12: 11000,     // AO: 390000 - Más suave
  13: 14000,     // AO: 600000 - Reducido
  14: 17500,     // AO: 850000 - Más alcanzable
  15: 21500,     // AO: 1100000 - Milestone importante
  16: 26000,     // Progresión lineal comienza
  17: 31000,
  18: 36500,
  19: 42500,
  20: 49000,     // Milestone nivel 20
  21: 56000,
  22: 63500,
  23: 71500,
  24: 80000,
  25: 89000,     // Milestone nivel 25
  26: 98500,
  27: 108500,
  28: 119000,
  29: 130000,
  30: 142000,    // Milestone nivel 30
  31: 155000,
  32: 169000,
  33: 184000,
  34: 200000,
  35: 217000,    // Milestone nivel 35
  36: 235000,
  37: 254000,
  38: 274000,
  39: 295000,
  40: 317000,    // Milestone nivel 40
  41: 340000,
  42: 364000,
  43: 389000,
  44: 415000,
  45: 442000,    // Milestone nivel 45
  46: 470000,
  47: 499000,
  48: 529000,
  49: 560000,
  50: 592000     // Nivel máximo
};

/**
 * Obtiene la experiencia necesaria para el siguiente nivel
 * @param {number} currentLevel - Nivel actual del personaje
 * @returns {number} Experiencia necesaria para el siguiente nivel
 */
export function getExpForNextLevel(currentLevel) {
  if (currentLevel >= 50) {
    return EXPERIENCE_TABLE[50]; // Máximo nivel alcanzado
  }
  
  const nextLevel = currentLevel + 1;
  return EXPERIENCE_TABLE[nextLevel] || 0;
}

/**
 * Obtiene la experiencia total acumulada hasta un nivel
 * @param {number} level - Nivel objetivo
 * @returns {number} Experiencia total acumulada
 */
export function getTotalExpForLevel(level) {
  let totalExp = 0;
  for (let i = 2; i <= level && i <= 50; i++) {
    totalExp += EXPERIENCE_TABLE[i];
  }
  return totalExp;
}

/**
 * Calcula el progreso porcentual hacia el siguiente nivel
 * @param {number} currentLevel - Nivel actual
 * @param {number} currentExp - Experiencia actual
 * @returns {number} Porcentaje de progreso (0-100)
 */
export function getExpProgress(currentLevel, currentExp) {
  if (currentLevel >= 50) {
    return 100; // Nivel máximo alcanzado
  }
  
  const expNeeded = getExpForNextLevel(currentLevel);
  return Math.min(100, (currentExp / expNeeded) * 100);
}

/**
 * Calcula cuántos niveles se pueden subir con la experiencia actual
 * @param {number} currentLevel - Nivel actual
 * @param {number} currentExp - Experiencia actual
 * @returns {object} { levels: number, remainingExp: number }
 */
export function calculateLevelUps(currentLevel, currentExp) {
  let level = currentLevel;
  let exp = currentExp;
  let levelsGained = 0;
  
  while (level < 50 && exp >= getExpForNextLevel(level)) {
    exp -= getExpForNextLevel(level);
    level++;
    levelsGained++;
  }
  
  return {
    levels: levelsGained,
    remainingExp: exp,
    newLevel: level
  };
}

/**
 * Modificadores de experiencia por clase
 * Algunas clases reciben más o menos exp por sus roles
 */
export const CLASS_EXP_MODIFIERS = {
  guerrero: 1.0,    // Estándar
  mago: 0.95,       // Ganan menos por ser más poderosos
  arquero: 1.0,     // Estándar
  clerigo: 0.95,    // Ganan menos por sus habilidades de soporte
  asesino: 1.05,    // Ganan más por ser de alto riesgo
  paladin: 0.95,    // Ganan menos por ser más resistentes
  bardo: 1.0,       // Estándar
  ladron: 1.05,     // Ganan más por ser de alto riesgo
  bandido: 1.0,     // Estándar
  cazador: 1.0,     // Estándar
  druida: 0.95,     // Ganan menos por sus habilidades
  trabajador: 1.1,  // Ganan más por ser de soporte
  pirata: 1.0       // Estándar
};

/**
 * Aplica el modificador de clase a la experiencia ganada
 * @param {number} exp - Experiencia base
 * @param {string} characterClass - Clase del personaje
 * @returns {number} Experiencia modificada
 */
export function applyClassModifier(exp, characterClass) {
  const modifier = CLASS_EXP_MODIFIERS[characterClass] || 1.0;
  return Math.floor(exp * modifier);
}

export default EXPERIENCE_TABLE;