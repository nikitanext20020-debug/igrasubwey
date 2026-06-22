import fs from 'fs';

function inspectGlbNodes(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunkLength = buffer.readUInt32LE(12);
  const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
  const gltf = JSON.parse(jsonStr);
  
  console.log(`\n=== File: ${filePath} ===`);
  if (gltf.nodes) {
    gltf.nodes.forEach((node, index) => {
      if (node.scale || node.rotation || node.translation || node.name) {
        console.log(`Node ${index} (${node.name || 'unnamed'}): translation=${JSON.stringify(node.translation)}, rotation=${JSON.stringify(node.rotation)}, scale=${JSON.stringify(node.scale)}`);
      }
    });
  }
}

inspectGlbNodes('public/models/vanya.glb');
inspectGlbNodes('public/models/liza.glb');
inspectGlbNodes('public/models/babkastoit.glb');
