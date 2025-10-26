// ImageKit Configuration
export const imagekitConfig = {
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '',
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '',
  authenticationEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_AUTH_ENDPOINT || '/api/imagekit/auth',
};

// Validate configuration
export function validateImageKitConfig() {
  if (!imagekitConfig.publicKey) {
    throw new Error('NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY is not defined');
  }
  if (!imagekitConfig.urlEndpoint) {
    throw new Error('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not defined');
  }
  return true;
}
