import type { AxiosRequestConfig } from 'axios';
import type { ApiProduct } from '../utils/productTransforms';
import type { ApiPublicSeller } from '../utils/sellerTransforms';

export type CustomAxiosRequestConfig = AxiosRequestConfig & Record<string, unknown>;

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ProductListResponse {
  products: ApiProduct[];
  pagination: PaginationMeta;
}

export interface SellerListResponse {
  sellers: ApiPublicSeller[];
  pagination: PaginationMeta;
}
