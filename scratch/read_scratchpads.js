import fs from 'fs';
import path from 'path';

const dir = '/Users/veronika/.gemini/antigravity-ide/brain/4864f57b-6537-4957-90a6-8ecea128a67b/browser/';
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.endsWith('.md')) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`=== File: ${file} ===`);
      console.log(content);
    }
  });
}
