import fs from 'node:fs/promises';
import path from 'node:path';
import { createProjectWorkspace } from './workspace.js';
import { runProjectProcess } from './process.js';
import { projectError, isWithin } from './policy.js';

export async function runGraphify({ files, command, args = ['-m', 'graphify'], signal, timeoutMs = 120000 }) {
  if (!command) return { status: 'unavailable', nodes: [], links: [] };
  const workspace = await createProjectWorkspace(files);
  try {
    const result = await runProjectProcess({
      command,
      args: [
        ...args,
        'extract',
        workspace.root,
        '--code-only',
        '--max-workers',
        '1',
        '--out',
        path.join(workspace.directory, 'result')
      ],
      cwd: workspace.root,
      env: workspace.env,
      timeoutMs,
      signal
    });
    if (result.code !== 0)
      throw projectError('PROJECT_GRAPH_FAILED', 'Graphify taraması tamamlanamadı. Araç kurulumunu kontrol edin.', 502);
    const graphPath = path.join(workspace.directory, 'result', 'graphify-out', 'graph.json');
    const real = await fs.realpath(graphPath);
    if (!isWithin(workspace.directory, real) || (await fs.stat(real)).size > 8 * 1024 * 1024) {
      throw projectError('PROJECT_GRAPH_INVALID', 'Graphify sonucu sınırları aşıyor.', 502);
    }
    let graph;
    try {
      graph = JSON.parse(await fs.readFile(real, 'utf8'));
    } catch {
      throw projectError('PROJECT_GRAPH_INVALID', 'Graphify geçerli JSON döndürmedi.', 502);
    }
    if (
      !Array.isArray(graph.nodes) ||
      !Array.isArray(graph.links) ||
      graph.nodes.length > 30000 ||
      graph.links.length > 100000
    ) {
      throw projectError('PROJECT_GRAPH_INVALID', 'Graphify grafiğinin biçimi geçersiz.', 502);
    }
    const inventory = new Map(files.map(f => [f.path, f]));
    const nodes = graph.nodes.flatMap(node => {
      if (!node.source_file) return [];
      if (!inventory.has(node.source_file) || typeof node.id !== 'string' || typeof node.label !== 'string') {
        throw projectError('PROJECT_GRAPH_INVALID', 'Graphify kaynak referansı proje sınırları dışında.', 502);
      }
      const line = Number(/^L(\d+)/.exec(node.source_location || '')?.[1] || 1);
      if (line < 1 || line > inventory.get(node.source_file).content.split('\n').length) {
        throw projectError('PROJECT_GRAPH_INVALID', 'Graphify satır referansı geçersiz.', 502);
      }
      return [{ id: node.id, label: node.label.slice(0, 200), path: node.source_file, line }];
    });
    const ids = new Set(nodes.map(n => n.id));
    const links = graph.links
      .filter(l => ids.has(l.source) && ids.has(l.target))
      .map(l => ({
        from: l.source,
        to: l.target,
        kind: String(l.relation || 'related').slice(0, 80),
        confidence: String(l.confidence || 'unknown').slice(0, 40)
      }));
    return { status: 'ready', nodes, links };
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'unavailable', nodes: [], links: [] };
    throw error;
  } finally {
    await workspace.dispose();
  }
}
