import { pool } from '../src/config/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample product data
const mockProducts = [
  {
    name: 'Elegant Black Dress',
    price: 89.99,
    description: 'A beautiful black dress perfect for evening events. Made with high-quality fabric for maximum comfort and style.',
    status: 'published',
    aesthetic: 'noir',
    image_url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80'
  },
  {
    name: 'Classic White Shirt',
    price: 49.99,
    description: 'A crisp white shirt for a professional look. Perfect for both office and casual wear.',
    status: 'published',
    aesthetic: 'classic',
    image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1025&q=80'
  },
  {
    name: 'Vintage Denim Jacket',
    price: 75.50,
    description: 'A stylish denim jacket with a vintage touch. Great for layering in any season.',
    status: 'published',
    aesthetic: 'vintage',
    image_url: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80',
  },
  {
    name: 'Summer Floral Dress',
    price: 65.99,
    description: 'Light and airy floral dress perfect for summer days. Features a comfortable fit and beautiful print.',
    status: 'draft',
    aesthetic: 'floral',
    image_url: 'https://images.unsplash.com/photo-1563178407-4e0a3d3f3e2e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80'
  },
  {
    name: 'Leather Crossbody Bag',
    price: 120.00,
    description: 'Elegant leather crossbody bag for everyday use. Fits all your essentials in style.',
    status: 'published',
    aesthetic: 'classic',
    image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1398&q=80'
  },
  {
    name: 'Silk Scarf',
    price: 35.99,
    description: 'Luxurious silk scarf with a beautiful pattern. Perfect for accessorizing any outfit.',
    status: 'published',
    aesthetic: 'elegant',
    image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=736&q=80'
  },
  {
    name: 'Wool Beanie',
    price: 29.99,
    description: 'Warm and stylish wool beanie for cold weather. Available in multiple colors.',
    status: 'published',
    aesthetic: 'casual',
    image_url: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80'
  }
];

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Test user credentials
    const testUser = {
      email: 'test2@example.com',
      password: 'password', // This will be hashed before saving
      fullName: 'Test User',
      storeName: 'Fashion Boutique',
      status: 'active'
    };
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(testUser.password, SALT_ROUNDS);
    
    // Check if test user already exists
    let sellerId;
    const existingUser = await client.query('SELECT id FROM sellers WHERE email = $1', [testUser.email]);
    
    if (existingUser.rows.length === 0) {
      // Create test user
      const newSeller = await client.query(
        `INSERT INTO sellers (
          email, password, full_name, store_name, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
        [
          testUser.email,
          hashedPassword,
          testUser.fullName,
          testUser.storeName,
          testUser.status
        ]
      );
      
      sellerId = newSeller.rows[0].id;
      console.log('Created test seller with ID:', sellerId);
    } else {
      // Update existing user's password to ensure it's correct
      sellerId = existingUser.rows[0].id;
      await client.query(
        'UPDATE sellers SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, sellerId]
      );
      console.log('Updated password for existing test user with ID:', sellerId);
    }
    
    // Clear existing products for this seller
    await client.query('DELETE FROM products WHERE seller_id = $1', [sellerId]);
    
    // Insert mock products
    for (const product of mockProducts) {
      const { name, price, description, image_url, status, aesthetic } = product;
      
      await client.query(
        `INSERT INTO products (
          name, price, description, image_url, seller_id, status, aesthetic, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [name, price, description, image_url, sellerId, status, aesthetic]
      );
    }
    
    await client.query('COMMIT');
    console.log('Successfully seeded database with mock products');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

// Run the seed function
seedDatabase().catch(console.error);
