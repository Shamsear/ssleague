/**
 * Set Telegram Bot Webhook
 * 
 * Run this script after deploying to set the webhook URL for your Telegram bot.
 * 
 * Usage:
 * node scripts/set-telegram-webhook.js https://yourdomain.com
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8441352131:AAGA03H7DpBCWwYZYYmyEnKEmLQ_zLTU9cw'

async function setWebhook() {
  const baseUrl = process.argv[2] || 'http://localhost:3000'
  const webhookUrl = `${baseUrl}/api/telegram/webhook`

  console.log(`Setting webhook to: ${webhookUrl}`)

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Webhook set successfully!')
      console.log('Webhook URL:', webhookUrl)
    } else {
      console.error('❌ Failed to set webhook:', data.description)
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error)
  }
}

// Get webhook info
async function getWebhookInfo() {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    )
    const data = await response.json()

    if (data.ok) {
      console.log('\nCurrent webhook info:')
      console.log(JSON.stringify(data.result, null, 2))
    }
  } catch (error) {
    console.error('Error getting webhook info:', error)
  }
}

setWebhook().then(() => getWebhookInfo())
