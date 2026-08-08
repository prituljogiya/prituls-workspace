/**
 * Parse a GitHub repo reference into { owner, repo }.
 * Accepts: owner/repo, https://github.com/owner/repo, git@github.com:owner/repo.git
 */
export function parseGithubRepo(input: string | null | undefined): { owner: string; repo: string } | null {
  if (!input) return null;
  let value = input.trim();
  if (!value) return null;

  // SSH form
  const sshMatch = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2].replace(/\.git$/i, '') };
  }

  // URL form
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value);
      if (!/github\.com$/i.test(url.hostname) && url.hostname !== 'www.github.com') {
        return null;
      }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
      }
      return null;
    }
  } catch {
    return null;
  }

  // owner/repo
  const simple = value.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  const parts = simple.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }

  return null;
}

export function githubRepoDisplay(owner: string, repo: string) {
  return `${owner}/${repo}`;
}
