// Test organizer registration endpoint
const testData = {
  full_name: "Test User",
  email: "test@example.com", 
  phone: "1234567890",
  password: "password123",
  passwordConfirm: "password123"
};

console.log('Testing organizer registration with data:', JSON.stringify(testData, null, 2));

// This would be the curl command to test:
// curl -X POST https://bybloshq-f1rz.onrender.com/api/organizers/register \
//   -H "Content-Type: application/json" \
//   -d '{"full_name":"Test User","email":"test@example.com","phone":"1234567890","password":"password123","passwordConfirm":"password123"}'
