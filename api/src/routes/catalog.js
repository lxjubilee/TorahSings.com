import { Router } from 'express';
import { ah } from '../util/async.js';
import {
  listCategories, listArtists, getArtist, getAlbumByCode, statusCounts, getManifest,
} from '../manifest.js';
import { config } from '../config.js';
import { HttpError } from '../middleware/rbac.js';

// Catalog reads come from the authoritative manifest (public, no auth required
// for browse). Editorial overlays (ratings/comments) live in their own routes.
const router = Router();

router.get('/categories', (req, res) => {
  res.json(listCategories());
});

router.get('/artists', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  res.json(listArtists(category));
});

router.get('/artists/:slug', (req, res) => {
  const artist = getArtist(req.params.slug);
  if (!artist) throw new HttpError(404, 'Artist not found');
  res.json(artist);
});

router.get('/albums/:code', (req, res) => {
  const album = getAlbumByCode(req.params.code);
  if (!album) throw new HttpError(404, 'Album not found');
  res.json(album);
});

// Legacy-compatible alias: /api/album?code=XXX or ?path=cat/artist/folder
router.get('/album', (req, res) => {
  const { code, path: relPath } = req.query;
  if (code) {
    const album = getAlbumByCode(code);
    if (!album) throw new HttpError(404, 'Album not found');
    return res.json(album);
  }
  if (relPath) {
    // Resolve by matching the manifest album path tail.
    const m = getManifest();
    for (const album of m.byAlbumCode.values()) {
      if (album.path && relPath.endsWith(album.folder)) {
        return res.json(getAlbumByCode(album.code));
      }
    }
    throw new HttpError(404, 'Album not found for path');
  }
  throw new HttpError(400, 'code or path query param required');
});

router.get('/status-counts', (req, res) => {
  const scope = typeof req.query.scope === 'string' ? req.query.scope : 'all';
  res.json(statusCounts(scope));
});

// HEAD-check a single CDN audio URL (ported from legacy /api/cdn-probe).
router.get('/cdn-probe', ah(async (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!url.startsWith(config.cdnBase)) throw new HttpError(400, 'url must be a CDN URL');
  try {
    const head = await fetch(url, { method: 'HEAD' });
    res.json({ url, ok: head.ok, status: head.status, contentType: head.headers.get('content-type') });
  } catch (err) {
    res.json({ url, ok: false, status: 0, error: err.message });
  }
}));

export default router;
