const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// AppCheckCore is a Swift pod (transitive via @react-native-google-signin)
// that depends on GoogleUtilities and RecaptchaInterop. Those targets don't
// define module maps, so pod install fails with:
//   "The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
//    `RecaptchaInterop`, which do not define modules."
// Declaring them with :modular_headers => true generates the maps. Targeted
// (rather than `use_modular_headers!` globally) so other pods aren't affected.
const MARKER = '# [withModularHeaders] enable module maps for AppCheckCore deps';
const BLOCK = `  ${MARKER}
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

function injectIntoPodfile(filePath) {
    const contents = fs.readFileSync(filePath, 'utf8');
    if (contents.includes(MARKER)) return;
    const updated = contents.replace(
        /(^\s*use_expo_modules!\s*$\n)/m,
        `$1\n${BLOCK}`,
    );
    if (updated === contents) {
        throw new Error('withModularHeaders: could not find use_expo_modules! anchor in Podfile');
    }
    fs.writeFileSync(filePath, updated);
}

module.exports = function withModularHeaders(config) {
    return withDangerousMod(config, [
        'ios',
        (cfg) => {
            const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
            if (fs.existsSync(podfile)) injectIntoPodfile(podfile);
            return cfg;
        },
    ]);
};
