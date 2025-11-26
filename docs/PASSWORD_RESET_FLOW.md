# Organizer Password Reset Flow

This document outlines the password reset functionality for organizers in the Byblos platform.

## Overview

The password reset flow consists of the following steps:

1. **Request Password Reset**: Organizer requests a password reset by providing their email address.
2. **Send Reset Email**: System sends a password reset email with a secure token.
3. **Reset Password**: Organizer clicks the link in the email and sets a new password.
4. **Confirm Reset**: System verifies the token and updates the password.

## API Endpoints

### 1. Request Password Reset

**Endpoint**: `POST /api/organizers/forgot-password`

**Request Body**:
```json
{
  "email": "organizer@example.com"
}
```

**Response**:
- Success (200): `{ "status": "success", "message": "If an account exists with this email, you will receive a password reset link." }`
- Error (400): `{ "status": "error", "message": "Please provide an email address" }`
- Error (500): `{ "status": "error", "message": "An error occurred while processing your request" }`

### 2. Verify Reset Token (Frontend)

**Endpoint**: `GET /api/organizers/verify-reset-token?token=:token&email=:email`

**Response**:
- Valid (200): `{ "status": "success", "message": "Token is valid" }`
- Invalid (400): `{ "status": "error", "message": "Invalid or expired token" }`
- Error (500): `{ "status": "error", "message": "An error occurred while verifying the token" }`

### 3. Reset Password

**Endpoint**: `POST /api/organizers/reset-password`

**Request Body**:
```json
{
  "email": "organizer@example.com",
  "token": "reset-token-from-email",
  "newPassword": "new-secure-password"
}
```

**Response**:
- Success (200): `{ "status": "success", "message": "Password has been reset successfully. You can now log in with your new password." }`
- Error (400): `{ "status": "error", "message": "Please provide email, token, and new password" }`
- Error (400): `{ "status": "error", "message": "Invalid or expired token. Please request a new password reset." }`
- Error (500): `{ "status": "error", "message": "An error occurred while resetting your password. Please try again." }`

## Frontend Routes

- `/organizer/forgot-password`: Form to request a password reset email
- `/organizer/reset-password?token=:token&email=:email`: Form to set a new password

## Security Considerations

1. **Token Expiration**: Password reset tokens expire after 1 hour.
2. **One-Time Use**: Tokens are single-use and become invalid after password reset.
3. **Rate Limiting**: Implement rate limiting on the forgot-password endpoint to prevent abuse.
4. **No User Enumeration**: The API does not reveal whether an email exists in the system.
5. **Secure Password Requirements**: Enforce strong password requirements (minimum 8 characters).

## Email Template

The password reset email template is located at `server/email-templates/reset-password.ejs` and supports both organizer and seller password resets with appropriate messaging.

## Database Changes

The following fields were added to the `organizers` table:
- `password_reset_token` (VARCHAR): Hashed reset token
- `password_reset_expires` (DATETIME): Token expiration timestamp

## Testing

To test the password reset flow:

1. Navigate to the organizer login page and click "Forgot password?"
2. Enter your email address and submit the form
3. Check your email for the password reset link
4. Click the link and set a new password
5. Verify you can log in with the new password

## Troubleshooting

- **Token Expired**: If the token has expired, request a new password reset email.
- **Invalid Token**: Ensure the full URL from the email is being used and hasn't been modified.
- **Email Not Received**: Check the spam folder and ensure the email address was entered correctly.
