import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addImportantItemBody,
  updateImportantItemBody,
  importantItemIdParam,
  importantItemsQuery,
} from '../schemas/importantItems.js';
import type {
  AddImportantItemInput,
  UpdateImportantItemInput,
  ImportantItemIdParam,
  ImportantItemsQuery,
} from '../schemas/importantItems.js';
import * as importantItemsService from '../services/importantItems.js';

const router = Router();

// GET /important-items — get user's important items
router.get('/',
  requireAuth,
  validate({ query: importantItemsQuery }),
  async (req, res, next) => {
    try {
      const { activeOnly } = req.query as unknown as ImportantItemsQuery;
      const items = await importantItemsService.getImportantItems(
        req.user!.userId,
        activeOnly,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// POST /important-items — add an important item
router.post('/',
  requireAuth,
  validate({ body: addImportantItemBody }),
  async (req, res, next) => {
    try {
      const { name, quantity } = req.body as AddImportantItemInput;
      const { item, reactivated } = await importantItemsService.addImportantItem(
        req.user!.userId,
        name,
        quantity,
      );

      if (reactivated) {
        res.json(item);
      } else {
        res.status(201).json(item);
      }
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /important-items/:item_id — update an important item
router.patch('/:item_id',
  requireAuth,
  validate({ params: importantItemIdParam, body: updateImportantItemBody }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params as unknown as ImportantItemIdParam;
      const updates = req.body as UpdateImportantItemInput;
      const item = await importantItemsService.updateImportantItem(
        req.user!.userId,
        itemId,
        updates,
      );
      res.json(item);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
