import fs from 'fs';

function inspectGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  
  // Read header
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'glTF') {
    console.error(`${filePath} is not a glTF file.`);
    return;
  }
  
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);
  
  // Read chunk 0 (JSON)
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString('utf8', 16, 20);
  
  if (chunkType !== 'JSON') {
    console.error(`First chunk in ${filePath} is not JSON.`);
    return;
  }
  
  const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
  const gltf = JSON.parse(jsonStr);
  
  console.log(`\n=== File: ${filePath} ===`);
  
  // Find accessors with POSITION attribute
  if (gltf.accessors) {
    const positionAccessors = [];
    if (gltf.meshes) {
      gltf.meshes.forEach(mesh => {
        mesh.primitives.forEach(prim => {
          if (prim.attributes && prim.attributes.POSITION !== undefined) {
            positionAccessors.push(prim.attributes.POSITION);
          }
        });
      });
    }
    
    // De-duplicate accessors
    const uniqueAccessors = Array.from(new Set(positionAccessors));
    
    uniqueAccessors.forEach(accIndex => {
      const accessor = gltf.accessors[accIndex];
      if (accessor) {
        console.log(`Accessor ${accIndex} (POSITION): min=${JSON.stringify(accessor.min)}, max=${JSON.stringify(accessor.max)}`);
        if (accessor.min && accessor.max) {
          const dx = accessor.max[0] - accessor.min[0];
          const dy = accessor.max[1] - accessor.min[1];
          const dz = accessor.max[2] - accessor.min[2];
          console.log(`  Dimensions: width=${dx.toFixed(3)}, height=${dy.toFixed(3)}, depth=${dz.toFixed(3)}`);
        }
      }
    });
  }
}

inspectGlb('public/models/vanya.glb');
inspectGlb('public/models/liza.glb');
inspectGlb('public/models/bottle.glb');
inspectGlb('public/models/babkastoit.glb');
