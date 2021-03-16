const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
    const hostname = (process.env.SERVICE_CONTAINER_NAME !== undefined ? process.env.SERVICE_CONTAINER_NAME : 'localhost');

    app.use(
        '/api',
        createProxyMiddleware({
            target: `http://${hostname}:3001`,
            changeOrigin: true,
        })
    );
};