import { createLLMProfileStore } from '../../src/profileStore.js';

process.on('message', async msg => {
  try {
    const { filePath, encryptionKey, prefix, count } = msg;
    const store = createLLMProfileStore({ filePath, encryptionKey });
    for (let i = 0; i < count; i++) {
      await store.save({
        name: `${prefix}-profile-${i}`,
        provider: 'custom',
        model: 'test-model',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'key'
      });
    }
    process.send({ ok: true, count });
  } catch (error) {
    process.send({ ok: false, error: error.message });
  }
});
