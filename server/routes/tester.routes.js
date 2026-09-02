import express from 'express';
import testerController from '../controllers/tester.controller.js';

const router = express.Router();

router.post('/set-exp', (req, res, next) => testerController.setExp(req, res, next));
router.post('/add-seeds', (req, res, next) => testerController.addSeeds(req, res, next));
router.post('/reset', (req, res, next) => testerController.reset(req, res, next));
router.post('/wipe-database', (req, res, next) => testerController.wipeDatabase(req, res, next));

export default router;
