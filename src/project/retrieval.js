import { selectProjectContext } from './context.js';
import { projectError } from './policy.js';

export function projectRetrievalMode(value, fallback = 'basic') {
  const mode = value === undefined ? fallback : value;
  if (!['basic', 'graphify'].includes(mode))
    throw projectError('PROJECT_PROMPT_INVALID', 'Analiz yöntemi basic veya graphify olmalıdır.');
  return mode;
}

export function retrieveProjectContext(
  snapshot,
  prompt,
  { graph, mode = 'basic', enabled = true, budget = 40000, documentRoles } = {}
) {
  const requestedMode = projectRetrievalMode(mode);
  const stale = graph?.status === 'stale' || (graph?.status === 'ready' && graph.revision !== snapshot.revision);
  const graphReady = enabled && graph?.status === 'ready' && !stale;
  const useGraph = requestedMode === 'graphify' && graphReady;
  const context = selectProjectContext(
    snapshot.files,
    prompt,
    budget,
    useGraph ? graph : null,
    documentRoles,
    snapshot.revision
  );
  const retrieval = {
    requestedMode,
    effectiveMode: useGraph ? 'graphify' : 'basic',
    reason:
      requestedMode === 'basic'
        ? 'basic-selected'
        : !enabled
          ? 'graph-disabled'
          : stale
            ? 'graph-stale'
            : !graphReady
              ? 'graph-unavailable'
              : context.graphUsed
                ? 'graph-ready'
                : 'no-graph-contribution',
    sourceRevision: snapshot.revision,
    graphRevision: ['ready', 'stale'].includes(graph?.status) ? graph.revision || null : null,
    graphReady,
    graphContributed: context.graphUsed,
    graphAddedFiles: context.graphAddedFiles.slice(0, 100),
    ...(context.graphEvidence.length ? { graphEvidence: context.graphEvidence } : {})
  };
  return { context, retrieval };
}
