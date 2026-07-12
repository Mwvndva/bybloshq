// Role login config for the smoke suite. Credentials are read from env
// (E2E_<ROLE>_EMAIL / E2E_<ROLE>_PASS) so no secrets live in the repo.
export interface RoleConfig {
  name: string;
  loginPath: string;
  dashPath: string;
  apiLogin: RegExp;
  email?: string;
  pass?: string;
  markers: string[];
}

export const ROLES: RoleConfig[] = [
  { name: 'seller',    loginPath: '/seller/login',   dashPath: '/seller/dashboard',    apiLogin: /\/api\/sellers\/login/,   email: process.env.E2E_SELLER_EMAIL,    pass: process.env.E2E_SELLER_PASS,    markers: ['Overview', 'Products', 'Orders'] },
  { name: 'buyer',     loginPath: '/buyer/login',    dashPath: '/buyer/dashboard',     apiLogin: /\/api\/buyers\/login/,    email: process.env.E2E_BUYER_EMAIL,     pass: process.env.E2E_BUYER_PASS,     markers: [] },
  { name: 'creator',   loginPath: '/creator/login',  dashPath: '/creator/dashboard',   apiLogin: /\/api\/creators\/login/,  email: process.env.E2E_CREATOR_EMAIL,   pass: process.env.E2E_CREATOR_PASS,   markers: ['Ambassador analysis', 'Linked shops'] },
  { name: 'logistics', loginPath: '/mzigo/login',    dashPath: '/mzigo/dashboard',      apiLogin: /\/api\/logistics\/login/, email: process.env.E2E_LOGISTICS_EMAIL, pass: process.env.E2E_LOGISTICS_PASS, markers: ['Delivery'] },
  { name: 'admin',     loginPath: '/admin',          dashPath: '/admin/dashboard',      apiLogin: /\/api\/admin\/login/,     email: process.env.E2E_ADMIN_EMAIL,     pass: process.env.E2E_ADMIN_PASS,     markers: [] },
  { name: 'marketing', loginPath: '/admin/marketing/login', dashPath: '/admin/marketing', apiLogin: /\/api\/admin\/marketing\/login/, email: process.env.E2E_MKT_EMAIL, pass: process.env.E2E_MKT_PASS, markers: [] },
];
