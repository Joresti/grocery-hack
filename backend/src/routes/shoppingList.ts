import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { shoppingListQuery } from '../schemas/shoppingList.js';
import type { ShoppingListQuery } from '../schemas/shoppingList.js';
import * as shoppingListService from '../services/shoppingList.js';

const router = Router();

router.get('/',
  validate({ query: shoppingListQuery }),
  async (req, res, next) => {
    try {
      const params = req.query as unknown as ShoppingListQuery;
      const result = await shoppingListService.getShoppingList(params);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
