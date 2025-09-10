const got = require('got');
const ArgParser = require('../ArgParser');

/**
 * getInternalGitIssues seraches text in the repos and return matched git issues
 * api/getInternalGitIssues?text=jdk_util
 * @param {string} text Required. Search text string. i.e., jdk_math
 * @return {object} matched git issues
 */

module.exports = async (req, res) => {
    try {
        const { text } = req.query;
        if (text) {
            const url = 'https://api.github.ibm.com';
            const repos = 'repo:runtimes/backlog+repo:runtimes/infrastructure';
            const credentails = ArgParser.getConfig();
            if (credentails[url] && credentails[url].token) {
                const response = await got(
                    `${url}/search/issues?q=${text}+${repos}`,
                    {
                        method: 'get',
                        headers: {
                            Authorization: `Bearer ${credentails[url].token}`,
                            Accept: 'application/vnd.github+json',
                        },
                        responseType: 'json',
                    }
                );
                if (response && response.body) {
                    res.send(response.body.items);
                } else {
                    res.send([]);
                }
            } else {
                res.send(`${url} and/or token not appear in trssConf.json`);
            }
        } else {
            res.send('expect text query parameter');
        }
    } catch (error) {
        const rawError = error.response?.data || error.message;
        console.error('Error fetching repos:', rawError);
        res.status(500).json({ error: String(rawError) });
    }
};
