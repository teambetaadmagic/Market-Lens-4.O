#!/usr/bin/env node

/**
 * PWA Icon Generator
 * Generates placeholder icons for PWA development
 * 
 * Usage: node scripts/generate-icons.js
 * 
 * Requirements:
 * - sharp (npm install sharp)
 * - or jimp (built-in, no extra dependencies)
 */

const fs = require('fs');
const path = require('path');

// Try to use sharp if available, otherwise fall back to jimp
let useSharp = false;
try {
  require('sharp');
  useSharp = true;
} catch (e) {
  console.log('sharp not found, using jimp...');
}

// Jimp fallback implementation
async function generateIconsWithJimp() {
  try {
    const Jimp = require('jimp');
    
    const iconsDir = path.join(__dirname, '../public/icons');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }
    
    console.log('📱 Generating PWA icons...\n');
    
    // Create a simple colored background as placeholder
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    
    for (const size of sizes) {
      // Create a simple gradient background
      const image = new Jimp(size, size, 0x0066CCFF);
      
      // Save the icon
      await image.writeAsync(path.join(iconsDir, `icon-${size}x${size}.png`));
      console.log(`✅ Created icon-${size}x${size}.png`);
      
      // Create maskable version
      await image.writeAsync(path.join(iconsDir, `icon-${size}x${size}-maskable.png`));
      console.log(`✅ Created icon-${size}x${size}-maskable.png`);
    }
    
    // Favicon sizes
    console.log('\n🔗 Generating favicons...\n');
    
    const faviconSizes = [
      { size: 32, name: 'favicon-32x32.png' },
      { size: 16, name: 'favicon-16x16.png' }
    ];
    
    for (const { size, name } of faviconSizes) {
      const image = new Jimp(size, size, 0x0066CCFF);
      await image.writeAsync(path.join(iconsDir, name));
      console.log(`✅ Created ${name}`);
    }
    
    // Apple touch icon
    console.log('\n🍎 Generating Apple icon...\n');
    const appleIcon = new Jimp(180, 180, 0x0066CCFF);
    await appleIcon.writeAsync(path.join(iconsDir, 'apple-touch-icon-180x180.png'));
    console.log('✅ Created apple-touch-icon-180x180.png');
    
    // Shortcut icons
    console.log('\n⚡ Generating shortcut icons...\n');
    const shortcutIcon = new Jimp(192, 192, 0x0066CCFF);
    await shortcutIcon.writeAsync(path.join(iconsDir, 'shortcut-new-order-192x192.png'));
    console.log('✅ Created shortcut-new-order-192x192.png');
    
    await shortcutIcon.writeAsync(path.join(iconsDir, 'shortcut-suppliers-192x192.png'));
    console.log('✅ Created shortcut-suppliers-192x192.png');
    
    console.log('\n✨ Icon generation complete!\n');
    console.log('📝 Important: These are placeholder icons with a solid blue background.');
    console.log('🎨 Please replace them with your actual app logo/icons.');
    console.log('📚 See PWA_SETUP_GUIDE.md for more details.\n');
    
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

// Sharp implementation
async function generateIconsWithSharp() {
  const sharp = require('sharp');
  const iconsDir = path.join(__dirname, '../public/icons');
  
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  console.log('📱 Generating PWA icons with Sharp...\n');
  
  // Create SVG source
  const svgSource = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(0,102,204);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(0,51,153);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#grad1)"/>
      <circle cx="256" cy="256" r="100" fill="rgba(255,255,255,0.3)"/>
    </svg>
  `;
  
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  
  for (const size of sizes) {
    // Create regular icon
    await sharp(Buffer.from(svgSource))
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
    console.log(`✅ Created icon-${size}x${size}.png`);
    
    // Create maskable icon
    await sharp(Buffer.from(svgSource))
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}x${size}-maskable.png`));
  }
  
  // Favicons
  console.log('\n🔗 Generating favicons...\n');
  
  await sharp(Buffer.from(svgSource))
    .resize(32, 32)
    .png()
    .toFile(path.join(iconsDir, 'favicon-32x32.png'));
  console.log('✅ Created favicon-32x32.png');
  
  await sharp(Buffer.from(svgSource))
    .resize(16, 16)
    .png()
    .toFile(path.join(iconsDir, 'favicon-16x16.png'));
  console.log('✅ Created favicon-16x16.png');
  
  // Apple touch icon
  console.log('\n🍎 Generating Apple icon...\n');
  await sharp(Buffer.from(svgSource))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon-180x180.png'));
  console.log('✅ Created apple-touch-icon-180x180.png');
  
  // Shortcut icons
  console.log('\n⚡ Generating shortcut icons...\n');
  await sharp(Buffer.from(svgSource))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'shortcut-new-order-192x192.png'));
  console.log('✅ Created shortcut-new-order-192x192.png');
  
  await sharp(Buffer.from(svgSource))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'shortcut-suppliers-192x192.png'));
  console.log('✅ Created shortcut-suppliers-192x192.png');
  
  console.log('\n✨ Icon generation complete!\n');
}

// Main execution
(async () => {
  try {
    if (useSharp) {
      await generateIconsWithSharp();
    } else {
      await generateIconsWithJimp();
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n💡 Tip: Install sharp for better icon generation');
    console.log('   npm install --save-dev sharp\n');
    process.exit(1);
  }
})();
