const got = require('got');
const ArgParser = require('../ArgParser');

/**
 * getInternalGitIssues searches text across user-configured Git hosts and repos.
 *
 * This endpoint supports multiple GitHub-style hosts (e.g., github.ibm.com, github.com)
 * as defined in the user-provided trssConf.json file loaded via --configFile.
 *
 * Example:
 *   GET api/getInternalGitIssues?text=jdk_util
 *
 * Config format (per host):
 * {
 *   "github.ibm.com": {
 *     "token": "<optional_token>",
 *     "repos": ["owner1/repo1", "owner2/repo2"]
 *   },
 *   "github.com": {
 *     "token": "<optional_token>",
 *     "repos": ["adoptium/aqa-test-tools"]
 *   }
 * }
 *
 * Behavior:
 *   - Loops through each host defined in config
 *   - Builds GitHub search queries for each repo in that host
 *   - Calls the host's /search/issues endpoint using got()
 *   - Collects and merges issue results from all hosts
 *   - Returns a combined array of GitHub issue objects
 *
 * @param {string} text - Required search query string
 * @return {Array<object>} Combined list of matched issues from all configured hosts
 */

module.exports = async (req, res) => {
    try {
        const { text } = req.query;
        if (!text) return res.send('expect text query parameter');

        const config = ArgParser.getConfig();
        if (!config)
            return res.send('No config file loaded. Use --configFile=<path>');

        const allIssues = [];

        // Loop through each host in the config
        for (const host of Object.keys(config)) {
            const hostCfg = config[host];

            // Validate host entry
            if (!hostCfg || !hostCfg.repos || !Array.isArray(hostCfg.repos)) {
                console.warn(`Skipping host ${host}: repos[] missing`);
                continue;
            }

            const repoQuery = hostCfg.repos.map((r) => `repo:${r}`).join('+');

            const baseUrl = host.startsWith('http') ? host : `https://${host}`;

            const url = `${baseUrl}/search/issues?q=${text}+${repoQuery}`;

            try {
                const response = await got(url, {
                    method: 'get',
                    headers: {
                        ...(hostCfg.token
                            ? { Authorization: `Bearer ${hostCfg.token}` }
                            : {}),
                        Accept: 'application/vnd.github+json',
                    },
                    responseType: 'json',
                });

                if (response.body?.items) {
                    allIssues.push(...response.body.items);
                }
            } catch (innerErr) {
                console.error(
                    `Error fetching from host ${host}:`,
                    innerErr.message
                );
            }
        }

        return res.send(allIssues);
    } catch (error) {
        const rawError = error.response?.data || error.message;
        console.error('Error fetching repos:', rawError);
        return res.status(500).json({ error: String(rawError) });
    }
};
