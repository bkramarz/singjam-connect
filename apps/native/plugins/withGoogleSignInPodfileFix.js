const { withPodfile } = require('@expo/config-plugins');

// @react-native-google-signin's iOS SDK pulls in GoogleUtilities/RecaptchaInterop/AppCheckCore,
// none of which define modules. This project doesn't call use_frameworks!, so CocoaPods
// defaults to static libraries, and pod install fails with "cannot yet be integrated as
// static libraries" unless these specific pods opt into modular headers.
const MODULAR_HEADER_PODS = ['GoogleUtilities', 'RecaptchaInterop', 'AppCheckCore'];

module.exports = function withGoogleSignInPodfileFix(config) {
  return withPodfile(config, (config) => {
    const marker = 'use_expo_modules!';
    if (config.modResults.contents.includes(marker) && !config.modResults.contents.includes('GoogleUtilities')) {
      const podDeclarations = MODULAR_HEADER_PODS.map((name) => `  pod '${name}', :modular_headers => true`).join('\n');
      config.modResults.contents = config.modResults.contents.replace(
        marker,
        `${marker}\n\n${podDeclarations}`
      );
    }
    return config;
  });
};
