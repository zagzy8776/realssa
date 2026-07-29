const fs = require('fs');
const content = fs.readFileSync('backend/services/ingestion.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('pool')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
