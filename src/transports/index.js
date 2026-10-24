import openai from './openai.js';
import anthropic from './anthropic.js';
import google from './google.js';

const transports = {
  openai,
  anthropic,
  google
};

export function getTransport(id = 'openai') {
  return transports[id] || transports.openai;
}

export { openai, anthropic, google };
