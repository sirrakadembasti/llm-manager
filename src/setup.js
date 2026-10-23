import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { parseEncryptionKey } from './profileStore.js';

export function ensureLLMEncryptionKey({
  envPath = path.join(process.cwd(), '.env'),
  profilePath = process.env.LLM_CONFIG_PATH || path.join(process.cwd(), 'data', 'llm-profiles.json'),
  environment = process.env,
  keyPath = environment.LLM_CONFIG_KEY_PATH || path.join(path.dirname(profilePath), 'llm-encryption.key')
} = {}) {
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : null;
  const configured =
    environment.LLM_CONFIG_ENCRYPTION_KEY ||
    (envContent && dotenv.parse(envContent).LLM_CONFIG_ENCRYPTION_KEY) ||
    (fs.existsSync(keyPath) && fs.readFileSync(keyPath, 'utf8').trim());
  if (configured) {
    parseEncryptionKey(configured);
    environment.LLM_CONFIG_ENCRYPTION_KEY = configured;
    return configured;
  }

  if (fs.existsSync(profilePath)) {
    const data = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    if (data.profiles?.some(profile => profile.secret)) {
      throw new Error(
        'Kayıtlı LLM profilleri var fakat şifreleme anahtarı yok. Önce eski LLM_CONFIG_ENCRYPTION_KEY değerini yedekten kurtarın.'
      );
    }
  }

  const key = crypto.randomBytes(32).toString('hex');
  if (environment.NODE_ENV === 'production') {
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    try {
      fs.writeFileSync(keyPath, `${key}\n`, { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return ensureLLMEncryptionKey({ envPath, profilePath, environment, keyPath });
    }
    environment.LLM_CONFIG_ENCRYPTION_KEY = key;
    return key;
  }

  const base = envContent ?? '';
  const content = /^LLM_CONFIG_ENCRYPTION_KEY=\s*$/m.test(base)
    ? base.replace(/^LLM_CONFIG_ENCRYPTION_KEY=\s*$/m, `LLM_CONFIG_ENCRYPTION_KEY=${key}`)
    : `${base.trimEnd()}${base.trim() ? '\n' : ''}LLM_CONFIG_ENCRYPTION_KEY=${key}\n`;
  fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600, flag: envContent === null ? 'wx' : 'w' });
  environment.LLM_CONFIG_ENCRYPTION_KEY = key;
  return key;
}
