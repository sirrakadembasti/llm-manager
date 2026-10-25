import { serverHelper } from './shared.js';
export default function manual({ PKG, esm }) {
  return { 'llm.js': serverHelper(PKG, esm) };
}
