import { protect, restrictTo } from './auth.js';

export const protectLogistics = [
  protect,
  restrictTo('logistics', 'admin')
];

export default protectLogistics;

