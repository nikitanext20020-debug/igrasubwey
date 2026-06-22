import fs from 'fs';

function inspectGlbNodesAll(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunkLength = buffer.readUInt32LE(12);
  const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
  const gltf = JSON.parse(jsonStr);
  
  console.log(`\n=== File: ${filePath} ===`);
  if (gltf.nodes) {
    gltf.nodes.forEach((node, index) => {
      if (node.scale) {
        console.log(`Node ${index} (${node.name || 'unnamed'}): scale=${JSON.stringify(node.scale)}`);
      }
    });
  }
}

inspectGlbNodesAll('public/models/vanya.glb');
inspectGlbNodesAll('public/models/liza.glb');
inspectGlbNodesAll('public/models/bottle.glb');
inspectGlbNodesAll('public/models/babkastoit.glb');
