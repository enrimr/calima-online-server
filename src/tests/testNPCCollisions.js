/**
 * Test script for NPC collision detection with map elements
 */

const MapManager = require('../systems/MapManager');
const NPCManager = require('../systems/NPCManager');

async function testNPCCollisions() {
    console.log('\n=== Testing NPC Collision Detection ===\n');

    try {
        // Initialize managers
        const mapManager = new MapManager();
        await mapManager.loadMaps();
        
        const npcManager = new NPCManager(null, mapManager);

        // Test 1: Check isPositionBlocked
        console.log('Test 1: Checking if positions are blocked');
        const testMap = 1;
        
        // Test some positions
        const testPositions = [
            { x: 50, y: 50, expected: 'walkable' },
            { x: 1, y: 1, expected: 'check map data' },
            { x: -1, y: 50, expected: 'blocked (out of bounds)' },
            { x: 1000, y: 1000, expected: 'blocked (out of bounds)' }
        ];

        for (const pos of testPositions) {
            const isBlocked = mapManager.isPositionBlocked(testMap, pos.x, pos.y);
            const canMove = mapManager.canMoveTo(testMap, pos.x, pos.y);
            console.log(`  Position (${pos.x}, ${pos.y}): blocked=${isBlocked}, canMove=${canMove} - ${pos.expected}`);
        }

        // Test 2: Test NPC movement with collision detection
        console.log('\nTest 2: Testing NPC movement with collision detection');
        
        // Load an NPC template
        const NPC = require('../models/NPC');
        const npcs = await NPC.find().limit(1);
        
        if (npcs.length === 0) {
            console.log('  No NPCs found in database, skipping movement test');
            return;
        }

        const npcData = npcs[0];
        console.log(`  Using NPC: ${npcData.name}`);

        // Try to spawn NPC in a valid position
        console.log('\nTest 3: Finding valid spawn position');
        const validPos = npcManager.findValidSpawnPosition(testMap);
        if (validPos) {
            console.log(`  Found valid position: (${validPos.x}, ${validPos.y})`);
            
            // Spawn the NPC
            const spawnedNPC = await npcManager.spawnNPC(npcData, validPos.x, validPos.y, testMap);
            if (spawnedNPC) {
                console.log(`  Successfully spawned NPC at (${validPos.x}, ${validPos.y})`);
                
                // Test movement in different directions
                console.log('\nTest 4: Testing NPC movement in all directions');
                const directions = ['north', 'south', 'east', 'west'];
                
                for (const direction of directions) {
                    const beforeState = npcManager.getNPCState(spawnedNPC.id);
                    const moved = npcManager.moveNPC(spawnedNPC.id, direction);
                    const afterState = npcManager.getNPCState(spawnedNPC.id);
                    
                    if (moved) {
                        console.log(`  ${direction}: Moved from (${beforeState.x}, ${beforeState.y}) to (${afterState.x}, ${afterState.y})`);
                    } else {
                        console.log(`  ${direction}: Movement blocked at (${beforeState.x}, ${beforeState.y})`);
                    }
                }

                // Test random movement
                console.log('\nTest 5: Testing random movement (10 attempts)');
                for (let i = 0; i < 10; i++) {
                    const beforePos = npcManager.getNPCState(spawnedNPC.id);
                    const moved = npcManager.moveNPCRandomly(spawnedNPC.id);
                    const afterPos = npcManager.getNPCState(spawnedNPC.id);
                    
                    if (moved) {
                        console.log(`  Attempt ${i + 1}: Moved from (${beforePos.x}, ${beforePos.y}) to (${afterPos.x}, ${afterPos.y})`);
                    } else {
                        console.log(`  Attempt ${i + 1}: Could not move from (${beforePos.x}, ${beforePos.y})`);
                    }
                }
            } else {
                console.log('  Failed to spawn NPC');
            }
        } else {
            console.log('  Could not find valid spawn position');
        }

        // Test 6: Try to spawn NPC in blocked position
        console.log('\nTest 6: Testing spawn in blocked position');
        const map = mapManager.getMapData(testMap);
        if (map) {
            // Find a blocked position
            let blockedX = -1;
            let blockedY = -1;
            
            for (let y = 0; y < map.height && blockedX === -1; y++) {
                for (let x = 0; x < map.width && blockedX === -1; x++) {
                    if (mapManager.isPositionBlocked(testMap, x, y)) {
                        blockedX = x;
                        blockedY = y;
                    }
                }
            }
            
            if (blockedX !== -1) {
                console.log(`  Trying to spawn at blocked position (${blockedX}, ${blockedY})`);
                const spawnResult = await npcManager.spawnNPC(npcData, blockedX, blockedY, testMap);
                if (!spawnResult) {
                    console.log('  ✓ Correctly prevented spawn in blocked position');
                } else {
                    console.log('  ✗ ERROR: Spawn succeeded in blocked position!');
                }
            } else {
                console.log('  No blocked positions found in map to test');
            }
        }

        console.log('\n=== All tests completed ===\n');

    } catch (error) {
        console.error('Error during tests:', error);
    }

    process.exit(0);
}

// Run tests
if (require.main === module) {
    // Connect to database
    const mongoose = require('mongoose');
    require('dotenv').config();

    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('Connected to MongoDB');
            return testNPCCollisions();
        })
        .catch(err => {
            console.error('MongoDB connection error:', err);
            process.exit(1);
        });
}

module.exports = testNPCCollisions;