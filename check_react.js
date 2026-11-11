const fs = require('fs');
const path = require('path');

function findReactDirs(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file === 'react') {
        results.push(filePath);
      } else if (file !== 'node_modules') {
        const subNodeModules = path.join(filePath, 'node_modules');
        if (fs.existsSync(subNodeModules)) {
          results = results.concat(findReactDirs(subNodeModules));
        }
      }
    }
  });
  return results;
}

console.log('Searching for react in node_modules...');
const rootNodeModules = path.join(__dirname, 'node_modules');
if (fs.existsSync(rootNodeModules)) {
  const reactDirs = findReactDirs(rootNodeModules);
  console.log('Found React directories:');
  reactDirs.forEach(d => {
    const pkgPath = path.join(d, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      console.log(`- ${d} (version: ${pkg.version})`);
    } else {
      console.log(`- ${d} (no package.json)`);
    }
  });
} else {
  console.log('No local node_modules folder found.');
}
