import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MapManager - Sistema de gestión de mapas del servidor
 * 
 * Responsabilidades:
 * - Cargar todos los mapas en memoria al iniciar
 * - Validar movimientos de jugadores (colisiones)
 * - Proporcionar información sobre tiles específicos
 * - Gestionar portales y transiciones
 */
class MapManager {
    constructor() {
        this.maps = new Map();
        this.mapsDirectory = path.join(__dirname, '../data/maps');
        
        // Tiles que bloquean el movimiento (basado en el cliente)
        // El cliente considera caminables: GRASS (0), FLOOR (6), PATH (8), FLOOR_INTERIOR (11)
        // Por lo tanto, todos los demás están bloqueados
        this.BLOCKED_TILES = {
            base: [2,3, 4, 5, 14, 15, 24, 26, 27, 22, 23, 34, 36, 37], // 4 = montaña/bordes, 5 = paredes, 14-15 = puertas cerradas
            props: [2, 3, 22, 23, 26, 27, 29, 24, 36, 37] // 2 y 3 = árboles/obstáculos
        };
        
        // Tiles explícitamente caminables
        this.WALKABLE_TILES = {
            base: [0, 6, 8, 11, 20, 21, 9, 17, 31, 32] // 0 = grass, 6 = floor, 8 = path, 11 = floor interior
        };
    }

    /**
     * Carga todos los mapas desde el directorio de datos
     */
    async loadAllMaps() {
        try {
            console.log('[MapManager] Cargando mapas desde:', this.mapsDirectory);
            
            const files = fs.readdirSync(this.mapsDirectory);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            for (const file of jsonFiles) {
                const mapId = file.replace('.json', '');
                const filePath = path.join(this.mapsDirectory, file);
                const mapData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                this.maps.set(mapId, mapData);
                console.log(`[MapManager] ✓ Mapa cargado: ${mapId} (${mapData.name})`);
            }
            
            console.log(`[MapManager] Total de mapas cargados: ${this.maps.size}`);
            return true;
        } catch (error) {
            console.error('[MapManager] Error cargando mapas:', error);
            throw error;
        }
    }

    /**
     * Obtiene un mapa por su ID
     */
    getMap(mapId) {
        return this.maps.get(mapId);
    }

    /**
     * Obtiene todos los IDs de mapas disponibles
     */
    getAllMapIds() {
        return Array.from(this.maps.keys());
    }

    /**
     * Verifica si una posición es caminable en un mapa
     * @param {string} mapId - ID del mapa
     * @param {number} x - Coordenada X
     * @param {number} y - Coordenada Y
     * @returns {boolean} true si es caminable, false si está bloqueado
     */
    isWalkable(mapId, x, y) {
        const map = this.maps.get(mapId);
        if (!map) {
            console.warn(`[MapManager] Mapa no encontrado: ${mapId}`);
            return false;
        }

        const layers = map.layers;
        if (!layers) {
            console.warn(`[MapManager] Mapa sin capas: ${mapId}`);
            return false;
        }

        // Verificar límites del mapa
        if (!layers.base || !layers.base[y] || layers.base[y][x] === undefined) {
            return false; // Fuera de límites
        }

        // Verificar capa base (terrain)
        const baseTile = layers.base[y][x];
        
        // Usar lista de tiles explícitamente caminables (más confiable que lista de bloqueados)
        if (!this.WALKABLE_TILES.base.includes(baseTile)) {
            return false; // Tile no está en la lista de caminables
        }

        // Verificar capa de props (árboles, rocas, etc.)
        if (layers.props && layers.props[y] && layers.props[y][x]) {
            const propTile = layers.props[y][x];
            if (this.BLOCKED_TILES.props.includes(propTile)) {
                return false; // Prop bloqueado
            }
        }

        // Verificar puertas (si están cerradas, bloquean)
        if (layers.doors && layers.doors[y] && layers.doors[y][x]) {
            const doorTile = layers.doors[y][x];
            if (doorTile > 0) {
                // Por ahora, todas las puertas bloquean
                // TODO: Implementar sistema de puertas abiertas/cerradas
                return false;
            }
        }

        return true; // La posición es caminable
    }

    /**
     * Valida un movimiento de un jugador
     * @param {string} mapId - ID del mapa actual
     * @param {number} fromX - Posición X actual
     * @param {number} fromY - Posición Y actual
     * @param {number} toX - Posición X destino
     * @param {number} toY - Posición Y destino
     * @returns {Object} { valid: boolean, reason?: string, portal?: Object }
     */
    validateMovement(mapId, fromX, fromY, toX, toY) {
        // Verificar que el movimiento sea adyacente (una casilla)
        const dx = Math.abs(toX - fromX);
        const dy = Math.abs(toY - fromY);
        
        if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
            return {
                valid: false,
                reason: 'Movimiento inválido: debe ser a una casilla adyacente'
            };
        }

        // Verificar que la casilla destino sea caminable
        if (!this.isWalkable(mapId, toX, toY)) {
            return {
                valid: false,
                reason: 'Posición bloqueada'
            };
        }

        // Verificar si hay un portal en la posición destino
        const portal = this.getPortalAt(mapId, toX, toY);
        
        return {
            valid: true,
            portal: portal || null
        };
    }

    /**
     * Obtiene un portal en una posición específica
     * @param {string} mapId - ID del mapa
     * @param {number} x - Coordenada X
     * @param {number} y - Coordenada Y
     * @returns {Object|null} Portal si existe, null si no
     */
    getPortalAt(mapId, x, y) {
        const map = this.maps.get(mapId);
        if (!map || !map.portals) {
            return null;
        }

        return map.portals.find(portal => portal.x === x && portal.y === y) || null;
    }

    /**
     * Obtiene la posición de spawn inicial de un mapa
     * @param {string} mapId - ID del mapa
     * @returns {Object|null} { x, y } o null si no existe
     */
    getSpawnPosition(mapId) {
        const map = this.maps.get(mapId);
        if (!map || !map.playerSpawn) {
            return null;
        }

        return {
            x: map.playerSpawn.x,
            y: map.playerSpawn.y
        };
    }

    /**
     * Obtiene información sobre NPCs en un mapa
     * @param {string} mapId - ID del mapa
     * @returns {Array} Lista de NPCs del mapa
     */
    getMapNPCs(mapId) {
        const map = this.maps.get(mapId);
        return map?.npcs || [];
    }

    /**
     * Obtiene información sobre enemigos en un mapa
     * @param {string} mapId - ID del mapa
     * @returns {Object|null} Configuración de enemigos o null
     */
    getMapEnemies(mapId) {
        const map = this.maps.get(mapId);
        return map?.enemies || null;
    }

    /**
     * Verifica si un mapa es zona segura (no PvP)
     * @param {string} mapId - ID del mapa
     * @returns {boolean}
     */
    isSafeZone(mapId) {
        const map = this.maps.get(mapId);
        return map?.safeZone || false;
    }

    /**
     * Obtiene las dimensiones de un mapa
     * @param {string} mapId - ID del mapa
     * @returns {Object} { width, height }
     */
    getMapDimensions(mapId) {
        const map = this.maps.get(mapId);
        if (!map || !map.layers || !map.layers.base) {
            return { width: 0, height: 0 };
        }

        const height = map.layers.base.length;
        const width = height > 0 ? map.layers.base[0].length : 0;

        return { width, height };
    }

    /**
     * Encuentra una posición caminable aleatoria en un mapa
     * @param {string} mapId - ID del mapa
     * @param {number} maxAttempts - Número máximo de intentos
     * @returns {Object|null} { x, y } o null si no encuentra
     */
    findRandomWalkablePosition(mapId, maxAttempts = 100) {
        const { width, height } = this.getMapDimensions(mapId);
        
        if (width === 0 || height === 0) {
            return null;
        }

        for (let i = 0; i < maxAttempts; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            
            if (this.isWalkable(mapId, x, y)) {
                return { x, y };
            }
        }

        return null; // No se encontró posición caminable
    }

    /**
     * Obtiene estadísticas de los mapas cargados
     */
    getStats() {
        const stats = {
            totalMaps: this.maps.size,
            maps: []
        };

        for (const [mapId, map] of this.maps) {
            const dimensions = this.getMapDimensions(mapId);
            stats.maps.push({
                id: mapId,
                name: map.name,
                type: map.type,
                safeZone: map.safeZone,
                dimensions: dimensions,
                hasPortals: (map.portals || []).length > 0,
                hasNPCs: (map.npcs || []).length > 0,
                hasEnemies: !!map.enemies
            });
        }

        return stats;
    }
}

// Singleton instance
let instance = null;

export function getInstance() {
    if (!instance) {
        instance = new MapManager();
    }
    return instance;
}

export { MapManager };
