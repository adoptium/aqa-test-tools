const path = require('path');
const webpack = require('webpack');

module.exports = {
    webpack: function override(config, env) {
        config.resolve.alias = {
            ...config.resolve.alias,
            CodeMirror: path.join(__dirname, 'node_modules', 'codemirror'),
            jQuery: path.join(__dirname, 'node_modules', 'jquery'),
            $: path.join(__dirname, 'node_modules', 'jquery'),
        };

        config.plugins.push(
            new webpack.ProvidePlugin({
                $: 'jquery',
                jQuery: 'jquery',
                CodeMirror: 'codemirror',
            })
        );

        return config;
    },
    devServer: function(configFunction) {
        return function(proxy, allowedHost) {
            const config = configFunction(proxy, allowedHost);
            // webpack-dev-server v4 rejects empty strings in allowedHosts.
            // This happens when HOST env var is unset.
            if (Array.isArray(config.allowedHosts)) {
                config.allowedHosts = config.allowedHosts.filter(h => h && h.trim() !== '');
                if (config.allowedHosts.length === 0) {
                    config.allowedHosts = 'auto';
                }
            }
            return config;
        };
    },
};
