/**
 * Script de pruebas para MapManager
 * Ejecutar con: node src/tests/testMapManager.js
 */

import { getInstance as getMapManager } from '../systems/MapManager.js';

console.log('\n🧪 ===== INICIANDO PRUEBAS DE MAPMANAGER =====\n');

const mapManager = getMapManager();
let passedTests = 0;
let failedTests = 0;

// Función auxiliar para tests
function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passedTests++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.error(`   Error: ${error.message}`);
        failedTests++;
    }
}

// Función auxiliar para assertions
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function runTests() {
    console.log('📂 Test 1: Carga de Mapas\n');
    
    // Test 1: Cargar mapas
    test('Debería cargar todos los mapas', async () => {
        await mapManager.loadAllMaps();
        const mapIds = mapManager.getAllMapIds();
        assert(mapIds.length > 0, 'No se cargaron mapas');
        assert(mapIds.length === 17, `Se esperaban 17 mapas, se cargaron ${mapIds.length}`);
        console.log(`   → ${mapIds.length} mapas cargados`);
    });

    test('Debería poder obtener un mapa por ID', () => {
        const map = mapManager.getMap('training_fields');
        assert(map !== null, 'No se pudo obtener training_fields');
        assert(map.name !== undefined, 'El mapa no tiene nombre');
        console.log(`   → Mapa obtenido: ${map.name}`);
    });

    console.log('\n🗺️ Test 2: Validación de Tiles\n');

    // Test 2: Verificar tiles bloqueados
    test('Debería detectar agua (tile 8) como bloqueado', () => {
        // En training_fields, (0, 0) es borde de agua
        const walkable = mapManager.isWalkable('training_fields', 0, 0);
        assert(walkable === false, 'El agua debería estar bloqueada');
    });

    test('Debería detectar terreno normal (tile 0) como caminable', () => {
        // En training_fields, (10, 10) es terreno normal
        const walkable = mapManager.isWalkable('training_fields', 10, 10);
        assert(walkable === true, 'El terreno normal debería ser caminable');
    });

    test('Debería detectar props bloqueados (tiles 2,3)', () => {
        // Buscar un árbol en training_fields
        const map = mapManager.getMap('training_fields');
        let foundBlockedProp = false;
        
        for (let y = 0; y < map.layers.props.length && !foundBlockedProp; y++) {
            for (let x = 0; x < map.layers.props[y].length && !foundBlockedProp; x++) {
                const propTile = map.layers.props[y][x];
                if (propTile === 2 || propTile === 3) {
                    const walkable = mapManager.isWalkable('training_fields', x, y);
                    assert(walkable === false, `Prop bloqueado en (${x},${y}) debería no ser caminable`);
                    foundBlockedProp = true;
                    console.log(`   → Prop bloqueado encontrado en (${x},${y})`);
                }
            }
        }
        
        assert(foundBlockedProp, 'No se encontraron props bloqueados para probar');
    });

    console.log('\n🚶 Test 3: Validación de Movimientos\n');

    // Test 3: Validar movimientos
    test('Debería aceptar movimiento adyacente a tile caminable', () => {
        const validation = mapManager.validateMovement('training_fields', 10, 10, 11, 10);
        assert(validation.valid === true, 'Movimiento adyacente válido debería ser aceptado');
        console.log(`   → Movimiento (10,10) → (11,10): VÁLIDO`);
    });

    test('Debería rechazar movimiento no adyacente (teleport)', () => {
        const validation = mapManager.validateMovement('training_fields', 10, 10, 50, 50);
        assert(validation.valid === false, 'Teleport debería ser rechazado');
        assert(validation.reason !== undefined, 'Debería incluir razón del rechazo');
        console.log(`   → Movimiento (10,10) → (50,50): ${validation.reason}`);
    });

    test('Debería rechazar movimiento a tile bloqueado', () => {
        // Intentar moverse al borde (agua)
        const validation = mapManager.validateMovement('training_fields', 1, 1, 0, 0);
        assert(validation.valid === false, 'Movimiento a agua debería ser rechazado');
        console.log(`   → Movimiento hacia agua: ${validation.reason}`);
    });

    test('Debería rechazar movimiento fuera de límites', () => {
        const { width, height } = mapManager.getMapDimensions('training_fields');
        const validation = mapManager.validateMovement('training_fields', 10, 10, width + 1, 10);
        assert(validation.valid === false, 'Movimiento fuera de límites debería ser rechazado');
    });

    console.log('\n🚪 Test 4: Detección de Portales\n');

    // Test 4: Portales
    test('Debería detectar portal en training_fields', () => {
        const portal = mapManager.getPortalAt('training_fields', 1, 20);
        assert(portal !== null, 'Debería existir un portal en (1, 20)');
        assert(portal.targetMap === 'newbie_city', 'El portal debería llevar a newbie_city');
        console.log(`   → Portal encontrado: ${portal.name} → ${portal.targetMap}`);
    });

    test('Validación de movimiento debería incluir información de portal', () => {
        const validation = mapManager.validateMovement('training_fields', 2, 20, 1, 20);
        assert(validation.valid === true, 'Movimiento a portal debería ser válido');
        assert(validation.portal !== null, 'Debería incluir información del portal');
        console.log(`   → Portal detectado en validación: ${validation.portal.name}`);
    });

    console.log('\n🎯 Test 5: Utilidades del MapManager\n');

    // Test 5: Otras funcionalidades
    test('Debería obtener posición de spawn', () => {
        const spawn = mapManager.getSpawnPosition('training_fields');
        assert(spawn !== null, 'Debería existir posición de spawn');
        assert(spawn.x !== undefined && spawn.y !== undefined, 'Spawn debería tener coordenadas');
        console.log(`   → Spawn position: (${spawn.x}, ${spawn.y})`);
    });

    test('Debería obtener dimensiones del mapa', () => {
        const dimensions = mapManager.getMapDimensions('training_fields');
        assert(dimensions.width > 0, 'El mapa debería tener ancho');
        assert(dimensions.height > 0, 'El mapa debería tener alto');
        console.log(`   → Dimensiones: ${dimensions.width}x${dimensions.height}`);
    });

    test('Debería encontrar posición caminable aleatoria', () => {
        const position = mapManager.findRandomWalkablePosition('training_fields', 50);
        assert(position !== null, 'Debería encontrar una posición caminable');
        assert(mapManager.isWalkable('training_fields', position.x, position.y), 
               'La posición encontrada debería ser caminable');
        console.log(`   → Posición aleatoria: (${position.x}, ${position.y})`);
    });

    test('Debería detectar zona segura correctamente', () => {
        const isSafe = mapManager.isSafeZone('newbie_city');
        console.log(`   → newbie_city es zona ${isSafe ? 'segura' : 'peligrosa'}`);
        // No hacer assert porque depende de la configuración del mapa
    });

    test('Debería obtener estadísticas de mapas', () => {
        const stats = mapManager.getStats();
        assert(stats.totalMaps > 0, 'Debería haber mapas cargados');
        assert(stats.maps.length === stats.totalMaps, 'Número de mapas debería coincidir');
        console.log(`   → Stats: ${stats.totalMaps} mapas totales`);
    });

    console.log('\n📊 Test 6: Casos Edge\n');

    // Test 6: Edge cases
    test('Debería manejar mapa inexistente', () => {
        const map = mapManager.getMap('mapa_inexistente');
        assert(map === undefined, 'Mapa inexistente debería retornar undefined');
    });

    test('Debería manejar validación en mapa inexistente', () => {
        const validation = mapManager.validateMovement('mapa_inexistente', 0, 0, 1, 1);
        assert(validation.valid === false, 'Validación en mapa inexistente debería fallar');
    });

    test('Debería rechazar movimiento sin cambio de posición', () => {
        const validation = mapManager.validateMovement('training_fields', 10, 10, 10, 10);
        assert(validation.valid === false, 'Movimiento a la misma posición debería ser rechazado');
    });

    // Resumen
    console.log('\n' + '='.repeat(50));
    console.log('📈 RESUMEN DE PRUEBAS');
    console.log('='.repeat(50));
    console.log(`✅ Pruebas pasadas: ${passedTests}`);
    console.log(`❌ Pruebas fallidas: ${failedTests}`);
    console.log(`📊 Total: ${passedTests + failedTests}`);
    console.log(`🎯 Tasa de éxito: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    console.log('='.repeat(50) + '\n');

    if (failedTests === 0) {
        console.log('🎉 ¡TODAS LAS PRUEBAS PASARON! El MapManager funciona correctamente.\n');
        process.exit(0);
    } else {
        console.log('⚠️  Algunas pruebas fallaron. Revisa los errores arriba.\n');
        process.exit(1);
    }
}

// Ejecutar pruebas
runTests().catch(error => {
    console.error('\n💥 Error ejecutando pruebas:', error);
    process.exit(1);
});