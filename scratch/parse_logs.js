import fs from 'fs';

const logPath = '/Users/veronika/.gemini/antigravity-ide/brain/4864f57b-6537-4957-90a6-8ecea128a67b/.system_generated/logs/transcript.jsonl';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line) => {
    try {
      const step = JSON.parse(line);
      // We are looking for tool responses that might contain the logs from capture_browser_console_logs
      if (step.type === 'CAPTURE_BROWSER_CONSOLE_LOGS' || (step.tool_calls && JSON.stringify(step.tool_calls).includes('capture_browser_console_logs'))) {
        console.log(`--- Step ${step.step_index} (${step.type}) ---`);
        console.log(JSON.stringify(step).substring(0, 1000));
      }
      if (step.content && (step.content.includes('console.log') || step.content.includes('console.error') || step.content.includes('console.warn'))) {
        console.log(`--- Step ${step.step_index} Content ---`);
        console.log(step.content.substring(0, 1000));
      }
    } catch(e) {}
  });
} else {
  console.log("No logs found");
}
