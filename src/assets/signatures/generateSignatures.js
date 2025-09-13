const fs = require('fs');
const path = require('path');

/**
 * Generate sample signature images for testing
 * This creates simple colored rectangles with text that look like signatures
 */

// Create a simple colored signature image as base64
const createSignatureImage = (name, color = '#4CAF50') => {
  // This is a simple 200x60 colored rectangle with text
  const svg = `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="60" fill="${color}" opacity="0.1" stroke="#dee2e6" stroke-width="1"/>
    <rect x="20" y="15" width="160" height="30" fill="${color}" opacity="0.3" rx="5"/>
    <text x="100" y="35" font-family="Arial, sans-serif" font-size="14" fill="#333" text-anchor="middle" font-weight="bold">${name}</text>
    <path d="M30 45 Q60 35 90 45 T150 45" stroke="#333" stroke-width="2" fill="none" opacity="0.7"/>
  </svg>`;

  return svg;
};

const signatures = [
  { name: 'signature1', displayName: 'John Doe', color: '#4CAF50' },
  { name: 'signature2', displayName: 'Jane Smith', color: '#2196F3' },
  { name: 'signature3', displayName: 'Mike Johnson', color: '#FF9800' },
  { name: 'signature4', displayName: 'Sarah Wilson', color: '#9C27B0' },
  { name: 'signature5', displayName: 'David Brown', color: '#F44336' },
  { name: 'signature6', displayName: 'Lisa Davis', color: '#607D8B' }
];

// Generate signature files
signatures.forEach(signature => {
  const svgPath = path.join(__dirname, `${signature.name}.svg`);
  const svgContent = createSignatureImage(signature.displayName, signature.color);

  fs.writeFileSync(svgPath, svgContent);
  console.log(`Created ${signature.name}.svg with ${signature.displayName}`);
});

// Create a default signature
const defaultSvg = createSignatureImage('Default Signature', '#666');
fs.writeFileSync(path.join(__dirname, 'default.svg'), defaultSvg);
console.log('Created default.svg');

console.log('\n✅ All signature files generated successfully!');
console.log('Note: These are placeholder images. Replace with real signature images for production use.');
