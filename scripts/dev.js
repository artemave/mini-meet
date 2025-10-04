#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

const execAsync = promisify(exec);

const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

async function getAvahiHostname() {
  try {
    const { stdout } = await execAsync("systemctl status avahi-daemon 2>/dev/null | grep -oP '(?<=running \\[)[^\\]]+' | head -n1");
    return stdout.trim();
  } catch {
    return '';
  }
}

async function main() {
  const port = process.env.PORT || '3003';

  // Get .local hostname
  const avahiHostname = await getAvahiHostname();
  const certHosts = avahiHostname
    ? `localhost 127.0.0.1 ${avahiHostname}`
    : 'localhost 127.0.0.1';

  console.log(`Generating SSL certificate for: ${certHosts}`);

  // Ensure certs directory exists
  if (!existsSync('certs')) {
    mkdirSync('certs');
  }

  // Generate certificate
  try {
    await execAsync(`mkcert -key-file certs/key.pem -cert-file certs/cert.pem ${certHosts}`);
  } catch (err) {
    console.error('Failed to generate certificate:', err.message);
    process.exit(1);
  }

  // Print URLs
  console.log('');
  console.log(`${GREEN}Starting dev server...${NC}`);
  console.log('');
  console.log(`${BLUE}Local:${NC}    https://localhost:${port}`);
  if (avahiHostname) {
    console.log(`${BLUE}Network:${NC}  https://${avahiHostname}:${port}`);
  }
  console.log('');

  // Start dev server with SSL and debug enabled
  const env = {
    ...process.env,
    SSL_CERT_PATH: 'certs/cert.pem',
    SSL_KEY_PATH: 'certs/key.pem',
    DEBUG: 'mini-meet:*',
    PORT: port,
  };

  const devProcess = spawn('npx', [
    'concurrently',
    '"NODE_ENV=development node --watch-path=./src --watch-preserve-output ./src/server.js"',
    '"npx @tailwindcss/cli -w -i ./src/styles.css -o ./public/styles.css"'
  ], {
    stdio: 'inherit',
    env,
    shell: true,
  });

  devProcess.on('exit', (code) => {
    process.exit(code);
  });
}

main().catch(console.error);
