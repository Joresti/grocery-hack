import fs from 'node:fs';
import path from 'node:path';

async function globalTeardown(): Promise<void> {
  const tokensPath = path.join(__dirname, '.e2e-tokens.json');
  if (fs.existsSync(tokensPath)) {
    fs.unlinkSync(tokensPath);
  }
}

export default globalTeardown;
