const got = require('got');

const DEFAULT_REPO = 'library/eclipse-temurin';
const REPO_REGEX = /^[a-z0-9_.-]+(\/[a-z0-9_.-]+)?$/i;

/**
 * getDockerTags looks up image tags on Docker Hub. It exists because the
 * Docker Hub API does not send CORS headers, so the browser cannot call it
 * directly.
 *
 * Example:
 *   GET api/getDockerTags?name=21.0.5_11-jdk
 *
 * @param {string} name - Required. Tag name (substring match) to search for
 * @param {string} repo - Optional. Docker Hub repository, defaults to
 *                        library/eclipse-temurin
 * @return {object} { count, tags: [{ name, platforms, lastUpdated }] }
 */
module.exports = async (req, res) => {
    const { name, repo = DEFAULT_REPO } = req.query;
    if (!name) {
        return res.send({ error: 'name query parameter is required' });
    }
    if (!REPO_REGEX.test(repo)) {
        return res.send({ error: `invalid repo: ${repo}` });
    }

    try {
        const response = await got(
            `https://hub.docker.com/v2/repositories/${repo}/tags/`,
            {
                searchParams: { name, page_size: 100 },
                responseType: 'json',
                timeout: 15000,
            }
        );
        const { count = 0, results = [] } = response.body;
        const tags = results.map((tag) => ({
            name: tag.name,
            lastUpdated: tag.last_updated,
            platforms: [
                ...new Set(
                    (tag.images || [])
                        .filter((i) => i.os !== 'unknown')
                        .map((i) => `${i.os}/${i.architecture}`)
                ),
            ].sort(),
        }));
        res.send({ count, tags });
    } catch (e) {
        res.send({ error: e.toString() });
    }
};
