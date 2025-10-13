import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Get encryption key from environment variable
// In production, this should be a secure, randomly generated key stored in environment variables
function getEncryptionKey(): Buffer {
  const key = process.env.BID_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('BID_ENCRYPTION_KEY environment variable is not set');
  }
  
  // Ensure key is exactly 32 bytes
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`BID_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (64 hex characters)`);
  }
  
  return keyBuffer;
}

/**
 * Encrypt sensitive bid data
 * Returns encrypted data in format: iv:authTag:encryptedData (all hex encoded)
 */
export function encryptBidData(data: { player_id: string; amount: number }): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt bid data');
  }
}

/**
 * Decrypt bid data
 */
export function decryptBidData(encryptedData: string): { player_id: string; amount: number } {
  try {
    const key = getEncryptionKey();
    
    // Parse encrypted format: iv:authTag:encryptedData
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt bid data');
  }
}

/**
 * Generate a new random encryption key
 * This should be run once and the key stored securely in environment variables
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
