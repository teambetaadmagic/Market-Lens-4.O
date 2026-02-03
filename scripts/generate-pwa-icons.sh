#!/bin/bash

# Icon Generator Script for PWA
# This script helps generate icons for your PWA

echo "MarketLens PWA Icon Generator"
echo "=============================="
echo ""
echo "This script requires:"
echo "1. ImageMagick (convert command)"
echo "2. A source logo image (logo.png or logo.svg)"
echo ""

# Check if source image exists
if [ ! -f "logo.png" ] && [ ! -f "logo.svg" ]; then
    echo "❌ Error: Please provide a 'logo.png' or 'logo.svg' file in the current directory"
    echo ""
    echo "Quick setup:"
    echo "1. Create a simple PNG logo (512x512 minimum)"
    echo "2. Place it as 'logo.png' in the project root"
    echo "3. Run this script again"
    exit 1
fi

# Create icons directory
mkdir -p public/icons
mkdir -p public/screenshots

echo "📁 Creating icon directories..."

# Source image
SOURCE_IMAGE="logo.png"
if [ -f "logo.svg" ]; then
    SOURCE_IMAGE="logo.svg"
    echo "📷 Using SVG source: $SOURCE_IMAGE"
else
    echo "📷 Using PNG source: $SOURCE_IMAGE"
fi

# Icon sizes to generate
declare -a SIZES=(72 96 128 144 152 192 384 512)

echo "🎨 Generating icons..."

if command -v convert &> /dev/null; then
    # Using ImageMagick
    for size in "${SIZES[@]}"; do
        echo "  - Creating ${size}x${size}..."
        convert "$SOURCE_IMAGE" -resize "${size}x${size}" -background white -alpha off "public/icons/icon-${size}x${size}.png" 2>/dev/null || true
        
        # Create maskable version
        convert "$SOURCE_IMAGE" -resize "${size}x${size}" "public/icons/icon-${size}x${size}-maskable.png" 2>/dev/null || true
    done
    
    # Create favicon sizes
    echo "  - Creating favicons..."
    convert "$SOURCE_IMAGE" -resize 32x32 "public/icons/favicon-32x32.png" 2>/dev/null || true
    convert "$SOURCE_IMAGE" -resize 16x16 "public/icons/favicon-16x16.png" 2>/dev/null || true
    convert "$SOURCE_IMAGE" -resize 32x32 "public/icons/favicon.ico" 2>/dev/null || true
    
    # Create apple touch icon
    echo "  - Creating Apple touch icon..."
    convert "$SOURCE_IMAGE" -resize 180x180 -background white -alpha off "public/icons/apple-touch-icon-180x180.png" 2>/dev/null || true
    
    echo "✅ Icons generated successfully!"
    
elif command -v ffmpeg &> /dev/null; then
    echo "⚠️  ImageMagick not found, but ffmpeg is available"
    echo "For best results, install ImageMagick:"
    echo "  macOS: brew install imagemagick"
    echo "  Linux: sudo apt-get install imagemagick"
    echo "  Windows: choco install imagemagick"
    exit 1
else
    echo "❌ Error: Neither ImageMagick nor ffmpeg found"
    echo ""
    echo "Install ImageMagick:"
    echo "  macOS: brew install imagemagick"
    echo "  Linux: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

# Create sample screenshots
echo "📸 Creating screenshot placeholders..."
echo "Please manually create or add screenshots:"
echo "  - public/screenshots/screenshot-192x144.png (narrow)"
echo "  - public/screenshots/screenshot-540x720.png (wide)"
echo ""

# Create placeholder shortcuts
echo "🔗 Creating shortcut icon placeholders..."
if command -v convert &> /dev/null; then
    convert "$SOURCE_IMAGE" -resize 192x192 "public/icons/shortcut-new-order-192x192.png" 2>/dev/null || true
    convert "$SOURCE_IMAGE" -resize 192x192 "public/icons/shortcut-suppliers-192x192.png" 2>/dev/null || true
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Customize the generated icons with your branding"
echo "2. Add screenshots to public/screenshots/"
echo "3. Test your PWA with: npm run dev"
echo "4. Check PWA readiness: lighthouse https://localhost:5173"
echo ""
echo "📚 For more details, see: PWA_SETUP_GUIDE.md"
