/**
 * Telegram Bot Polling for Local Development
 * 
 * This script runs a polling loop to receive Telegram messages
 * and forwards them to the local webhook handler.
 * 
 * Usage:
 * node scripts/telegram-bot-poll.js
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8441352131:AAGA03H7DpBCWwYZYYmyEnKEmLQ_zLTU9cw'
const WEBHOOK_URL = 'http://localhost:3000/api/telegram/webhook'

let offset = 0
let isPolling = false

async function getUpdates() {
  if (isPolling) return // Prevent concurrent polling
  
  isPolling = true
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`
    )
    const data = await response.json()

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        console.log('\n📨 Received update ID:', update.update_id)
        
        // Forward to local webhook
        try {
          const webhookResponse = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update)
          })
          console.log('✅ Forwarded to webhook, status:', webhookResponse.status)
        } catch (err) {
          console.error('❌ Error forwarding to webhook:', err.message)
        }

        // Update offset AFTER processing to mark as read
        offset = update.update_id + 1
      }
      console.log('Updated offset to:', offset)
    }
  } catch (error) {
    console.error('Error getting updates:', error.message)
  } finally {
    isPolling = false
  }
}

console.log('🤖 Telegram bot polling started...')
console.log(`📍 Forwarding to: ${WEBHOOK_URL}`)
console.log('Press Ctrl+C to stop\n')

// Clear webhook first
fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`)
  .then(() => {
    console.log('✅ Webhook cleared, starting polling...\n')
    // Poll every 2 seconds (reduced frequency to prevent duplicates)
    setInterval(getUpdates, 2000)
  })
  .catch(err => console.error('Error clearing webhook:', err))
