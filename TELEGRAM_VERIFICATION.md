# Telegram Verification Setup

This project uses Telegram Bot for free player verification during registration.

## Features

- ✅ **Free Telegram verification** - No SMS costs
- ✅ **Automatic polling** - Works in local development
- ✅ **Email fallback** - Players without Telegram can request admin approval
- ✅ **Admin panel** - Committee admins can approve email verification requests

## Setup

### 1. Bot Configuration

Your Telegram bot is already configured:
- **Bot Username**: @ssleague16bot
- **Bot Token**: Stored in `.env.local`

### 2. Running Locally

Start the Telegram bot polling service (in a separate terminal):

```bash
node scripts/telegram-bot-poll.js
```

This script:
- Clears any existing webhooks
- Polls Telegram for new messages
- Forwards them to your local webhook handler

Keep this running while testing locally.

### 3. Testing the Flow

1. Go to player registration: `http://localhost:3000/register/player?season=SSPSLS15`
2. Search for a player and click verify
3. Click "Generate Telegram Verification Code"
4. Copy the 6-digit code
5. Open Telegram and message @ssleague16bot
6. Send the code to the bot
7. The bot will verify and the page will auto-update

### 4. Production Deployment

When deploying to production (requires HTTPS):

```bash
node scripts/set-telegram-webhook.js https://yourdomain.com
```

This sets a webhook so Telegram sends messages directly to your server.

## Player Flow

### Option 1: Telegram Verification (Recommended)

1. Player clicks "Generate Telegram Verification Code"
2. A 6-digit code is generated and displayed
3. Player opens Telegram and messages @ssleague16bot
4. Player sends the code
5. Bot verifies and responds with success
6. Registration page auto-detects verification (polls every 3 seconds)
7. Player is registered

### Option 2: Email Verification (Fallback)

1. Player clicks "Request Email Verification from Admin"
2. Player enters email and optional reason
3. Request is submitted to committee admins
4. Admin views pending requests on `/register/players?season=SSPSLS15`
5. Admin approves or rejects the request
6. If approved, player is automatically registered

## Firestore Collections

### `telegram_verifications`
```javascript
{
  player_id: string,
  season_id: string,
  verification_code: string, // 6-digit code
  telegram_user_id: string | null,
  telegram_username: string | null,
  telegram_first_name: string | null,
  verified: boolean,
  created_at: Timestamp,
  expires_at: Timestamp, // 10 minutes from creation
  verified_at: Timestamp | null
}
```

### `email_verification_requests`
```javascript
{
  player_id: string,
  season_id: string,
  email: string,
  reason: string,
  status: 'pending' | 'approved' | 'rejected',
  created_at: Timestamp,
  approved_at: Timestamp | null,
  rejected_at: Timestamp | null
}
```

## API Endpoints

### POST `/api/telegram/generate-code`
Generates a verification code for a player.

**Request:**
```json
{
  "playerId": "P001",
  "seasonId": "SSPSLS15"
}
```

**Response:**
```json
{
  "success": true,
  "verificationCode": "123456",
  "botUsername": "ssleague16bot"
}
```

### POST `/api/telegram/check-verification`
Checks if a code has been verified.

**Request:**
```json
{
  "verificationCode": "123456"
}
```

**Response:**
```json
{
  "verified": true,
  "telegramUserId": "123456789",
  "telegramUsername": "johndoe"
}
```

### POST `/api/telegram/webhook`
Receives messages from Telegram bot (via polling or webhook).

### POST `/api/telegram/request-email-verification`
Submits an email verification request.

**Request:**
```json
{
  "playerId": "P001",
  "seasonId": "SSPSLS15",
  "email": "player@example.com",
  "reason": "Don't have Telegram"
}
```

## Troubleshooting

### Bot not responding to messages

1. Check if polling script is running:
   ```bash
   node scripts/telegram-bot-poll.js
   ```

2. Check bot token in `.env.local`

3. Verify Next.js dev server is running on port 3000

### Code expires before verification

- Codes expire after 10 minutes
- Player can generate a new code

### Verification not detected

- The page polls every 3 seconds
- Wait up to 3 seconds after sending code to bot
- Check browser console for errors

## Security Notes

- Verification codes expire after 10 minutes
- Each code can only be used once
- Telegram user IDs are stored for audit trail
- Email requests require admin approval
