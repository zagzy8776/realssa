import fs from 'fs';
import path from 'path';

const packageJsonPath = path.join(process.cwd(), 'package.json');
const capacitorConfigPath = path.join(process.cwd(), 'capacitor.config.ts');
const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

// 1. Read package.json version
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
console.log(`Current version in package.json: ${currentVersion}`);

// Parse version
const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Invalid version format: ${currentVersion}. Must be x.y.z`);
  process.exit(1);
}

// 2. Increment patch version
parts[2] += 1;
const nextVersion = parts.join('.');
console.log(`Bumping version to: ${nextVersion}`);

// 3. Update package.json
packageJson.version = nextVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated package.json');

// 4. Update capacitor.config.ts
if (fs.existsSync(capacitorConfigPath)) {
  let capConfig = fs.readFileSync(capacitorConfigPath, 'utf8');
  // Replace version: '0.0.37' or similar
  const versionRegex = /(version:\s*['"])([^'"]+)(['"])/;
  if (versionRegex.test(capConfig)) {
    capConfig = capConfig.replace(versionRegex, `$1${nextVersion}$3`);
    fs.writeFileSync(capacitorConfigPath, capConfig);
    console.log('✅ Updated capacitor.config.ts');
  } else {
    console.warn('⚠️ Could not find version key in capacitor.config.ts');
  }
}

// 5. Update android/app/build.gradle
if (fs.existsSync(buildGradlePath)) {
  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  
  // Update versionName
  const versionNameRegex = /(versionName\s*['"])([^'"]+)(['"])/;
  if (versionNameRegex.test(buildGradle)) {
    buildGradle = buildGradle.replace(versionNameRegex, `$1${nextVersion}$3`);
    console.log('✅ Updated versionName in android/app/build.gradle');
  } else {
    console.warn('⚠️ Could not find versionName in build.gradle');
  }

  // Update and increment versionCode
  const versionCodeRegex = /(versionCode\s+)(\d+)/;
  const match = buildGradle.match(versionCodeRegex);
  if (match) {
    const currentCode = parseInt(match[2], 10);
    const nextCode = currentCode + 1;
    buildGradle = buildGradle.replace(versionCodeRegex, `$1${nextCode}`);
    console.log(`✅ Incremented versionCode in android/app/build.gradle to ${nextCode}`);
  } else {
    console.warn('⚠️ Could not find versionCode in build.gradle');
  }

  fs.writeFileSync(buildGradlePath, buildGradle);
} else {
  console.warn('⚠️ android/app/build.gradle not found, skipping native version update');
}

console.log('\n🎉 Version bump process complete!');
console.log('To deploy this version via Capgo, run:');
console.log(`  npm run build`);
console.log(`  npx @capgo/cli@latest bundle upload com.realssa.news --path ./dist --channel production -b ${nextVersion}\n`);
