const fs = require('fs');
const path = require('path');

function findReactDirs(dir) {
  let results = [];
  try {
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
  } catch (_) {}
  return results;
}

console.log('Searching for react in workspace parent node_modules...');
const parentNodeModules = path.join(__dirname, '../node_modules');
if (fs.existsSync(parentNodeModules)) {
  const reactDirs = findReactDirs(parentNodeModules);
  console.log('Found React directories in parent:');
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
  console.log('No parent node_modules folder found.');
}
