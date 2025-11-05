// Download Instagram image and save to public/awards folder
// Usage: node scripts/download-instagram-image.js <instagram-image-url> <output-filename>

const https = require('https');
const fs = require('fs');
const path = require('path');

const imageUrl = process.argv[2];
const outputFilename = process.argv[3] || `award-${Date.now()}.jpg`;

if (!imageUrl) {
  console.error('Usage: node scripts/download-instagram-image.js <instagram-image-url> <output-filename>');
  process.exit(1);
}

// Create awards directory if it doesn't exist
const awardsDir = path.join(__dirname, '..', 'public', 'awards');
if (!fs.existsSync(awardsDir)) {
  fs.mkdirSync(awardsDir, { recursive: true });
}

const outputPath = path.join(awardsDir, outputFilename);

console.log(`Downloading image from: ${imageUrl}`);
console.log(`Saving to: ${outputPath}`);

https.get(imageUrl, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download image. Status: ${response.statusCode}`);
    process.exit(1);
  }

  const fileStream = fs.createWriteStream(outputPath);
  response.pipe(fileStream);

  fileStream.on('finish', () => {
    fileStream.close();
    console.log(`✅ Image saved successfully!`);
    console.log(`\nUse this URL in your database:`);
    console.log(`/awards/${outputFilename}`);
    console.log(`\nSQL Example:`);
    console.log(`UPDATE awards SET instagram_link = '/awards/${outputFilename}' WHERE id = 'your_award_id';`);
  });
}).on('error', (err) => {
  console.error(`Error downloading image: ${err.message}`);
  process.exit(1);
});
