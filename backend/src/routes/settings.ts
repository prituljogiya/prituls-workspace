import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
  SETTING_KEYS,
  deleteSetting,
  getGithubToken,
  maskToken,
  setSetting,
} from '../utils/settings';

const router = express.Router();

router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

// GET /api/settings/github — status only (masked, never full token)
router.get('/github', async (_req: AuthRequest, res) => {
  try {
    const { token, source } = await getGithubToken();
    res.json({
      configured: !!token,
      source,
      maskedToken: maskToken(token),
    });
  } catch (error) {
    console.error('Get GitHub settings error:', error);
    res.status(500).json({ error: 'Failed to load GitHub settings' });
  }
});

// PUT /api/settings/github — save token from admin UI
router.put('/github', async (req: AuthRequest, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      return res.status(400).json({
        error: 'Token should start with ghp_ or github_pat_',
      });
    }

    await setSetting(SETTING_KEYS.GITHUB_TOKEN, token);
    res.json({
      message: 'GitHub token saved',
      configured: true,
      source: 'admin',
      maskedToken: maskToken(token),
    });
  } catch (error: any) {
    console.error('Save GitHub settings error:', error);
    res.status(500).json({
      error: 'Failed to save GitHub token',
      details: error?.message || String(error),
    });
  }
});

// DELETE /api/settings/github — clear admin-saved token (env fallback may remain)
router.delete('/github', async (_req: AuthRequest, res) => {
  try {
    await deleteSetting(SETTING_KEYS.GITHUB_TOKEN);
    const { token, source } = await getGithubToken();
    res.json({
      message: 'Admin GitHub token cleared',
      configured: !!token,
      source,
      maskedToken: maskToken(token),
    });
  } catch (error) {
    console.error('Clear GitHub settings error:', error);
    res.status(500).json({ error: 'Failed to clear GitHub token' });
  }
});

// POST /api/settings/github/test — verify token against GitHub API
router.post('/github/test', async (_req: AuthRequest, res) => {
  try {
    const { token, source } = await getGithubToken();
    if (!token) {
      return res.status(400).json({ error: 'No GitHub token configured', ok: false });
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'PMS-Admin',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(400).json({
        ok: false,
        error: `GitHub returned ${response.status}`,
        details: body.slice(0, 200),
        source,
      });
    }

    const user = (await response.json()) as { login?: string; name?: string };
    res.json({
      ok: true,
      source,
      login: user.login,
      name: user.name || null,
    });
  } catch (error) {
    console.error('Test GitHub token error:', error);
    res.status(500).json({ ok: false, error: 'Failed to test GitHub token' });
  }
});

export default router;
