const path = require('path');
const webpack = require('webpack');

module.exports = function override(config, env) {
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
};
