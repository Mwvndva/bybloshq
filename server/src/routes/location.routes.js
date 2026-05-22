import express from 'express';
import * as locationController from '../controllers/location.controller.js';

const router = express.Router();

router.get('/search', locationController.search);

export default router;
