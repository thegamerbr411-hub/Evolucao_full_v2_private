const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

config.resolver.blockList = /.*(\\|\/)(android(\\|\/)app(\\|\/)build|android(\\|\/)build|node_modules(\\|\/).*(\\|\/)android(\\|\/)build|node_modules(\\|\/).*(\\|\/)android(\\|\/)\.cxx)(\\|\/).*/;

module.exports = config;
