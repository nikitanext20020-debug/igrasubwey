import fs from 'fs';

const logPath = '/Users/veronika/.gemini/antigravity-ide/brain/4864f57b-6537-4957-90a6-8ecea128a67b/.system_generated/logs/transcript.jsonl';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line) => {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls && JSON.stringify(obj.tool_calls).includes('execute_browser_javascript')) {
        console.log(`--- Step ${obj.step_index} call ---`);
        console.log(JSON.stringify(obj.tool_calls));
      }
      if (obj.type === 'TOOL_RESPONSE' && obj.output && (obj.output.includes('node_0.001') || obj.output.includes('NaN') || obj.output.includes('babushka'))) {
        console.log(`--- Step ${obj.step_index} response ---`);
        console.log(obj.output.substring(0, 1500));
      }
    } catch(e) {}
  });
} else {
  console.log("No logs");
}
