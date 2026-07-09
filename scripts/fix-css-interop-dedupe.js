// nativewind and apps/native both depend on react-native-css-interop@0.2.6, but npm
// installs two separate physical copies instead of deduping them into one, even with a
// matching root "overrides" pin. Two copies means two module instances with split
// style-registry state, which breaks NativeWind styling at runtime (renders unstyled).
// This forces a single shared instance by symlinking nativewind's nested copy to
// apps/native's copy. Runs as a postinstall step since it doesn't survive npm install.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const canonical = path.join(root, 'apps/native/node_modules/react-native-css-interop');
const duplicate = path.join(root, 'node_modules/nativewind/node_modules/react-native-css-interop');

if (!fs.existsSync(canonical)) {
  process.exit(0);
}

const duplicateStat = fs.lstatSync(duplicate, { throwIfNoEntry: false });

if (duplicateStat?.isSymbolicLink() && fs.realpathSync(duplicate) === fs.realpathSync(canonical)) {
  process.exit(0);
}

if (duplicateStat) {
  fs.rmSync(duplicate, { recursive: true, force: true });
}

fs.mkdirSync(path.dirname(duplicate), { recursive: true });
fs.symlinkSync(path.relative(path.dirname(duplicate), canonical), duplicate, 'dir');
console.log('[fix-css-interop-dedupe] symlinked nativewind\'s react-native-css-interop to apps/native\'s copy');
