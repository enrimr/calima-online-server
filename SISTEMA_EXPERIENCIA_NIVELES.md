# Sistema de Experiencia y Niveles - Calima Online

## Descripción General

Sistema completo de progresión de personajes basado en Argentum Online pero modernizado para una mejor experiencia de juego. El sistema incluye:

- Tabla de experiencia balanceada (niveles 1-50)
- Modificadores de experiencia por clase
- Subida automática de niveles con mejora de stats
- Notificaciones en tiempo real al cliente
- Curación completa al subir de nivel

## Tabla de Experiencia

### Comparación con Argentum Online

| Nivel | Calima Online | Argentum Online | Diferencia |
|-------|---------------|-----------------|------------|
| 2     | 100 EXP       | 300 EXP        | -66%       |
| 5     | 900 EXP       | 8,100 EXP      | -89%       |
| 10    | 6,500 EXP     | 170,000 EXP    | -96%       |
| 15    | 21,500 EXP    | 1,100,000 EXP  | -98%       |
| 20    | 49,000 EXP    | -              | -          |
| 30    | 142,000 EXP   | -              | -          |
| 40    | 317,000 EXP   | -              | -          |
| 50    | 592,000 EXP   | -              | Máximo     |

### Ventajas del Sistema de Calima

1. **Niveles iniciales más rápidos**: Mejor retención de jugadores nuevos
2. **Curva exponencial suave**: No hay saltos bruscos de dificultad
3. **Progresión predecible**: Los jugadores pueden planear su avance
4. **Nivel máximo 50**: Contenido post-nivel más extenso

## Modificadores de Experiencia por Clase

```javascript
guerrero: 1.0    // Estándar
mago: 0.95       // -5% (más poderosos)
arquero: 1.0     // Estándar
clerigo: 0.95    // -5% (soporte)
asesino: 1.05    // +5% (alto riesgo)
paladin: 0.95    // -5% (más resistentes)
bardo: 1.0       // Estándar
ladron: 1.05     // +5% (alto riesgo)
bandido: 1.0     // Estándar
cazador: 1.0     // Estándar
druida: 0.95     // -5% (habilidades)
trabajador: 1.1  // +10% (soporte)
pirata: 1.0      // Estándar
```

## Subida de Nivel

### Stats Base por Clase

Cada clase gana diferentes stats al subir de nivel:

**Guerrero** (Tank/DPS físico):
- STR: +3, DEX: +1, INT: 0, CON: +3, CHA: +1
- HP: +10, Mana: +3

**Mago** (DPS mágico):
- STR: 0, DEX: +1, INT: +3, CON: +1, CHA: +2
- HP: +7, Mana: +8

**Arquero** (DPS a distancia):
- STR: +1, DEX: +3, INT: +1, CON: +2, CHA: +1
- HP: +9, Mana: +4

**Clérigo** (Soporte/Curación):
- STR: +1, DEX: +1, INT: +2, CON: +2, CHA: +3
- HP: +8, Mana: +7

**Asesino** (DPS crítico):
- STR: +2, DEX: +3, INT: +1, CON: +1, CHA: +1
- HP: +8, Mana: +3

**Paladín** (Tank/Soporte):
- STR: +2, DEX: +1, INT: +1, CON: +3, CHA: +2
- HP: +9, Mana: +5

### Bonificaciones Adicionales

Además de los stats base por clase, cada subida de nivel incluye:

- **HP adicional**: +1 por cada 10 puntos de Constitución
- **Mana adicional**: +1 por cada 10 puntos de Inteligencia
- **Stamina**: +5 por nivel
- **Curación completa**: HP, Mana y Stamina se restauran al 100%
- **Mejora de daño**: El daño min/max aumenta con el nivel

### Límites de Stats

- **Máximo por stat**: 99
- **Nivel máximo**: 50

## Implementación Técnica

### Servidor

#### 1. Tabla de Experiencia (`src/config/experienceTable.js`)

```javascript
export const EXPERIENCE_TABLE = {
  1: 0,
  2: 100,
  3: 250,
  // ... hasta nivel 50
};
```

Funciones útiles:
- `getExpForNextLevel(currentLevel)`: Obtiene EXP necesaria para el próximo nivel
- `applyClassModifier(exp, characterClass)`: Aplica modificador de clase
- `calculateLevelUps(currentLevel, currentExp)`: Calcula cuántos niveles se suben

#### 2. Modelo Character (`src/models/Character.js`)

Métodos importantes:
- `getExpForNextLevel()`: Usa la tabla de experiencia
- `levelUp()`: Sube de nivel y retorna información detallada
- `addExperience(amount)`: Añade exp y procesa level ups automáticamente

#### 3. NPCManager (`src/systems/NPCManager.js`)

```javascript
async updatePlayerRewards(playerId, experience, gold) {
  // 1. Aplicar modificador de clase
  const modifiedExp = applyClassModifier(experience, character.class);
  
  // 2. Añadir experiencia (gestiona level ups automáticamente)
  const result = character.addExperience(modifiedExp);
  
  // 3. Notificar al cliente si hubo level ups
  if (result.levelUps.length > 0) {
    io.emit('level_up', {...});
  }
  
  // 4. Actualizar stats siempre
  io.emit('stats_update', {...});
}