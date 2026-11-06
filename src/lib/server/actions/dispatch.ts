import { log } from '$lib/log';

export interface DispatchEnv {
  GITHUB_PAT_ACTIONS_DISPATCH?: string;
  GITHUB_REPO?: string; // 'owner/repo'
}

// Fires a GitHub `workflow_dispatch` event. The target workflow must accept
// its inputs; the agent passes `nonce` so the callback into /api/ingest can
// be uniquely identified.
export async function dispatchWorkflow(
  env: DispatchEnv,
  workflowFile: string,
  ref: string,
  inputs: Record<string, string>
): Promise<void> {
  if (!env.GITHUB_PAT_ACTIONS_DISPATCH) throw new Error('GITHUB_PAT_ACTIONS_DISPATCH missing');
  if (!env.GITHUB_REPO) throw new Error('GITHUB_REPO missing (expected owner/repo)');

  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${encodeURIComponent(
    workflowFile
  )}/dispatches`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_PAT_ACTIONS_DISPATCH}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'wheres-my-plane'
    },
    body: JSON.stringify({ ref, inputs })
  });
  if (!resp.ok) {
    const text = await resp.text();
    log.warn('dispatch.fail', { workflow: workflowFile, status: resp.status, text });
    throw new Error(`workflow_dispatch ${workflowFile} → ${resp.status}: ${text.slice(0, 200)}`);
  }
}
