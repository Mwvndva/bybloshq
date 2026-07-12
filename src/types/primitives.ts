// Leaf primitive types shared across the type barrel and the api/* type
// modules. Kept in a dependency-free file so api/product.ts and api/seller.ts
// can import them without creating a cycle through the ./index barrel.
export type ProductType = 'physical' | 'digital' | 'service';
export type Theme =
  | 'default'
  | 'black'
  | 'pink'
  | 'orange'
  | 'green'
  | 'red'
  | 'yellow'
  | 'brown';
