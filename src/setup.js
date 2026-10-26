import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseEncryptionKey, encrypt, decrypt } from './profileStore.js';
import { withFileLockSync, robustRenameSync } from './store/fileLock.js';
import { LLMError, ErrorCodes } from './errors.js';

function parseSimpleEnv(content) {
  const result = {};
  for (const line of String(content || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

export function ensureLLMEncryptionKey(options = {}) {
  return ensureEncryptionKey(options);
}

function ensureEncryptionKey(
  {
    envPath = path.join(process.cwd(), '.env'),
    profilePath = process.env.LLM_CONFIG_PATH || path.join(process.cwd(), 'data', 'llm-profiles.json'),
    environment = process.env,
    keyPath = environment.LLM_CONFIG_KEY_PATH || path.join(path.dirname(profilePath), 'llm-encryption.key'),
    writeEnv
  } = {},
  lockHeld = false
) {
  const fileKey =
    !environment.LLM_CONFIG_ENCRYPTION_KEY && fs.existsSync(keyPath) && fs.readFileSync(keyPath, 'utf8').trim();
  if (writeEnv !== true && !environment.LLM_CONFIG_ENCRYPTION_KEY && !fileKey && !lockHeld) {
    return withFileLockSync(`${profilePath}.lock`, () =>
      ensureEncryptionKey({ envPath, profilePath, environment, keyPath, writeEnv }, true)
    );
  }
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : null;
  const configured =
    environment.LLM_CONFIG_ENCRYPTION_KEY ||
    fileKey ||
    (envContent && parseSimpleEnv(envContent).LLM_CONFIG_ENCRYPTION_KEY);
  if (configured) {
    parseEncryptionKey(configured);
    if (writeEnv !== true && !environment.LLM_CONFIG_ENCRYPTION_KEY && !fileKey) {
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      try {
        fs.writeFileSync(keyPath, `${configured}\n`, { mode: 0o600, flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // An independent key-file writer won; validate and use its key without overwriting it.
        const winner = fs.readFileSync(keyPath, 'utf8').trim();
        parseEncryptionKey(winner);
        environment.LLM_CONFIG_ENCRYPTION_KEY = winner;
        return winner;
      }
    }
    environment.LLM_CONFIG_ENCRYPTION_KEY = configured;
    return configured;
  }

  if (fs.existsSync(profilePath)) {
    const data = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    if (data.profiles?.some(profile => profile.secret)) {
      throw new LLMError(
        ErrorCodes.PROFILE_INVALID,
        'Kayıtlı LLM profilleri var fakat şifreleme anahtarı yok. Önce eski LLM_CONFIG_ENCRYPTION_KEY değerini yedekten kurtarın.',
        { status: 400, retryable: false }
      );
    }
  }

  const key = crypto.randomBytes(32).toString('hex');

  // Legacy .env persistence is explicitly opt-in.
  const shouldWriteEnv = writeEnv === true;

  if (shouldWriteEnv) {
    const base = envContent ?? '';
    const content = /^LLM_CONFIG_ENCRYPTION_KEY=\s*$/m.test(base)
      ? base.replace(/^LLM_CONFIG_ENCRYPTION_KEY=\s*$/m, `LLM_CONFIG_ENCRYPTION_KEY=${key}`)
      : `${base.trimEnd()}${base.trim() ? '\n' : ''}LLM_CONFIG_ENCRYPTION_KEY=${key}\n`;
    fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600, flag: envContent === null ? 'wx' : 'w' });
    environment.LLM_CONFIG_ENCRYPTION_KEY = key;
    return key;
  }

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  try {
    fs.writeFileSync(keyPath, `${key}\n`, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return ensureEncryptionKey({ envPath, profilePath, environment, keyPath, writeEnv }, lockHeld);
  }
  environment.LLM_CONFIG_ENCRYPTION_KEY = key;
  return key;
}

export function rotateEncryptionKey({
  dataDir,
  filePath = process.env.LLM_CONFIG_PATH ||
    (dataDir ? path.join(dataDir, 'llm-profiles.json') : path.join(process.cwd(), 'data', 'llm-profiles.json')),
  keyPath = process.env.LLM_CONFIG_KEY_PATH || path.join(path.dirname(filePath), 'llm-encryption.key'),
  oldKey,
  newKey
} = {}) {
  return withFileLockSync(`${filePath}.lock`, () => {
    const activeOldKey =
      oldKey ||
      process.env.LLM_CONFIG_ENCRYPTION_KEY ||
      (fs.existsSync(keyPath) ? fs.readFileSync(keyPath, 'utf8').trim() : null);
    if (!activeOldKey) {
      throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Eski şifreleme anahtarı bulunamadı.', { status: 400 });
    }
    const oldKeyBytes = parseEncryptionKey(activeOldKey);
    const activeNewKey = newKey || crypto.randomBytes(32).toString('hex');
    const newKeyBytes = parseEncryptionKey(activeNewKey);

    const originalProfiles = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
    const backupKeyPath = `${keyPath}.old-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.writeFileSync(backupKeyPath, `${activeOldKey}\n`, { mode: 0o600, flag: 'wx' });
    let reEncryptedCount = 0;
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      validateStore(data);
      if (Array.isArray(data.profiles)) {
        for (const profile of data.profiles) {
          if (profile.secret) {
            const plainApiKey = decrypt(profile.secret, oldKeyBytes);
            profile.secret = encrypt(plainApiKey, newKeyBytes);
            reEncryptedCount++;
          }
        }
      }
      const bakPath = `${filePath}.bak`;
      fs.copyFileSync(filePath, bakPath);
      atomicWrite(filePath, JSON.stringify(data, null, 2));
    }

    const keyTemporary = `${keyPath}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(keyTemporary, `${activeNewKey}\n`, { mode: 0o600, flag: 'wx' });
      robustRenameSync(keyTemporary, keyPath);
    } catch (error) {
      if (originalProfiles !== null) atomicWrite(filePath, originalProfiles);
      fs.rmSync(keyTemporary, { force: true });
      throw error;
    }
    process.env.LLM_CONFIG_ENCRYPTION_KEY = activeNewKey;

    return {
      ok: true,
      count: reEncryptedCount,
      newKey: activeNewKey,
      backupKeyPath
    };
  });
}

export function exportProfiles({
  dataDir,
  filePath = process.env.LLM_CONFIG_PATH ||
    (dataDir ? path.join(dataDir, 'llm-profiles.json') : path.join(process.cwd(), 'data', 'llm-profiles.json')),
  keyPath = process.env.LLM_CONFIG_KEY_PATH || path.join(path.dirname(filePath), 'llm-encryption.key'),
  encryptionKey,
  password,
  outputPath
} = {}) {
  if (!password || typeof password !== 'string' || password.length < 4) {
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Yedekleme için geçerli bir parola gereklidir (en az 4 karakter).', {
      status: 400
    });
  }
  if (!outputPath) {
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Çıktı dosya yolu (--out) belirtilmelidir.', { status: 400 });
  }

  if ([filePath, keyPath].some(target => path.resolve(target) === path.resolve(outputPath)))
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Yedek yolu depo veya anahtar dosyası olamaz.', { status: 400 });
  return withFileLockSync(`${filePath}.lock`, () => {
    const activeKey =
      encryptionKey ||
      process.env.LLM_CONFIG_ENCRYPTION_KEY ||
      (fs.existsSync(keyPath) ? fs.readFileSync(keyPath, 'utf8').trim() : null);
    const keyBytes = activeKey ? parseEncryptionKey(activeKey) : null;

    if (!fs.existsSync(filePath)) {
      throw new LLMError(ErrorCodes.PROFILE_NOT_FOUND, 'Dışa aktarılacak profil dosyası bulunamadı.', { status: 404 });
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const storeData = JSON.parse(raw);
    validateStore(storeData);
    const exportedProfiles = (storeData.profiles || []).map(p => {
      const copy = { ...p };
      if (copy.secret) {
        if (!keyBytes) {
          throw new LLMError(
            ErrorCodes.PROFILE_INVALID,
            'Şifreli profilleri çözmek için şifreleme anahtarı gereklidir.',
            {
              status: 400
            }
          );
        }
        copy.apiKey = decrypt(copy.secret, keyBytes);
        delete copy.secret;
      }
      return copy;
    });

    const exportPayload = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      activeId: storeData.activeId || null,
      profiles: exportedProfiles
    });

    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(exportPayload, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const backupDoc = {
      format: 'llm-manager-backup',
      version: 1,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex')
    };

    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    atomicWrite(outputPath, JSON.stringify(backupDoc, null, 2));
    return {
      ok: true,
      profileCount: exportedProfiles.length,
      outputPath: path.resolve(outputPath)
    };
  });
}

export function importProfiles({
  dataDir,
  filePath = process.env.LLM_CONFIG_PATH ||
    (dataDir ? path.join(dataDir, 'llm-profiles.json') : path.join(process.cwd(), 'data', 'llm-profiles.json')),
  keyPath = process.env.LLM_CONFIG_KEY_PATH || path.join(path.dirname(filePath), 'llm-encryption.key'),
  encryptionKey,
  password,
  inputPath,
  replace = false
} = {}) {
  if (!password || typeof password !== 'string') {
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Yedeği açmak için parola gereklidir.', { status: 400 });
  }
  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new LLMError(ErrorCodes.PROFILE_NOT_FOUND, 'İçe aktarılacak yedek dosyası bulunamadı.', { status: 404 });
  }

  let backupDoc;
  try {
    backupDoc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch {
    throw new LLMError(ErrorCodes.STORE_CORRUPT, 'Yedek dosyası bozuk veya geçersiz JSON.', { status: 400 });
  }

  if (
    backupDoc.format !== 'llm-manager-backup' ||
    !backupDoc.salt ||
    !backupDoc.iv ||
    !backupDoc.tag ||
    !backupDoc.data
  ) {
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Geçersiz yedek dosyası formatı.', { status: 400 });
  }

  const salt = Buffer.from(backupDoc.salt, 'hex');
  const iv = Buffer.from(backupDoc.iv, 'hex');
  const tag = Buffer.from(backupDoc.tag, 'hex');
  const data = Buffer.from(backupDoc.data, 'hex');

  const derivedKey = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  let decryptedPayload;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    decryptedPayload = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Yedek parolası hatalı veya dosya bütünlüğü bozulmuş.', {
      status: 400
    });
  }

  const parsed = JSON.parse(decryptedPayload);
  if (
    parsed.version !== 1 ||
    !Array.isArray(parsed.profiles) ||
    parsed.profiles.some(p => !p || typeof p.id !== 'string' || typeof p.apiKey !== 'string' || !p.apiKey)
  )
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Geçersiz yedek profilleri.', { status: 400 });
  const importedProfiles = parsed.profiles;

  return withFileLockSync(`${filePath}.lock`, () => {
    let targetKey =
      encryptionKey ||
      process.env.LLM_CONFIG_ENCRYPTION_KEY ||
      (fs.existsSync(keyPath) ? fs.readFileSync(keyPath, 'utf8').trim() : null);
    if (!targetKey) {
      targetKey = ensureEncryptionKey({ profilePath: filePath, keyPath }, true);
    }
    const targetKeyBytes = parseEncryptionKey(targetKey);
    let existingData = { version: 1, activeId: null, profiles: [] };
    if (fs.existsSync(filePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (cause) {
        throw new LLMError(ErrorCodes.STORE_CORRUPT, 'Hedef profil dosyası bozuk; içe aktarım durduruldu.', {
          status: 400,
          cause
        });
      }
      if (existingData.version !== undefined && existingData.version !== 1)
        throw new LLMError(ErrorCodes.STORE_VERSION_UNSUPPORTED, 'Desteklenmeyen depo sürümü.', { status: 400 });
    }
    const currentProfiles = existingData.profiles || [];
    let count = 0;

    for (const item of importedProfiles) {
      const copy = { ...item };
      if (copy.apiKey) {
        copy.secret = encrypt(copy.apiKey, targetKeyBytes);
        delete copy.apiKey;
      }
      copy.revision = crypto.randomUUID();

      const existingIndex = currentProfiles.findIndex(p => p.id === copy.id);
      if (existingIndex >= 0) {
        if (replace) {
          currentProfiles[existingIndex] = copy;
          count++;
        }
      } else {
        currentProfiles.push(copy);
        count++;
      }
    }

    existingData.profiles = currentProfiles;
    if (!existingData.activeId && parsed.activeId && currentProfiles.some(p => p.id === parsed.activeId)) {
      existingData.activeId = parsed.activeId;
    }

    existingData.version = 1;
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, `${filePath}.bak`);
    atomicWrite(filePath, JSON.stringify(existingData, null, 2));

    return {
      ok: true,
      importedCount: count,
      totalCount: currentProfiles.length
    };
  });
}

function atomicWrite(target, content) {
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { mode: 0o600, flag: 'wx' });
    robustRenameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function validateStore(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.profiles))
    throw new LLMError(ErrorCodes.STORE_CORRUPT, 'Geçersiz profil deposu.', { status: 400 });
  if (data.version !== undefined && data.version !== 0 && data.version !== 1)
    throw new LLMError(ErrorCodes.STORE_VERSION_UNSUPPORTED, 'Desteklenmeyen depo sürümü.', { status: 400 });
}
