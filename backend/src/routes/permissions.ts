import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { catalogPayload } from '../permissions/catalog';
import {
  getEffectiveRole,
  getGrantsForRole,
  getPermissionMatrix,
  savePermissionMatrix,
} from '../permissions/matrix';

const router = express.Router();

router.use(authenticate);

// Current catalog + matrix. Pass ?projectId= to resolve project-member role.
router.get('/', async (req: AuthRequest, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const matrix = await getPermissionMatrix();
    const effectiveRole = await getEffectiveRole(req.userId!, req.user?.role, projectId);
    const grants = await getGrantsForRole(effectiveRole);

    res.json({
      catalog: catalogPayload,
      matrix,
      effectiveRole,
      globalRole: req.user?.role,
      grants,
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to load permissions' });
  }
});

router.put('/', authorize('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  try {
    const matrix = req.body?.matrix;
    if (!matrix || typeof matrix !== 'object') {
      return res.status(400).json({ error: 'matrix is required' });
    }

    const saved = await savePermissionMatrix(matrix);
    res.json({
      message: 'Role permissions saved',
      catalog: catalogPayload,
      matrix: saved,
    });
  } catch (error) {
    console.error('Save permissions error:', error);
    res.status(500).json({ error: 'Failed to save permissions' });
  }
});

export default router;
