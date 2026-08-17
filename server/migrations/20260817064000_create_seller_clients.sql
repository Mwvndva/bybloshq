-- Migration: Create seller_clients table to track buyer-seller following

CREATE TABLE IF NOT EXISTS public.seller_clients (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES public.sellers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (seller_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_clients_seller_id ON public.seller_clients(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_clients_user_id ON public.seller_clients(user_id);
