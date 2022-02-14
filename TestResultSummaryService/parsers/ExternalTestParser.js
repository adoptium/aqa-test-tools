const Parser = require('./Parser');
const Utils = require('./Utils');

class ExternalTestParser extends Parser {
    static canParse(buildName) {
        if (buildName.endsWith('_Personal')) {
            return false;
        }
        const info = Utils.getInfoFromBuildName(buildName);
        return info && info.group.toLowerCase() === 'external';
    }

    parseExternal(results) {
        let externalTestExtraData;
        let testInfo = [];
        let res = results.map(({ testData, ...test }) => {
            const testTags = this.extractTestTags(test.testOutput);
            const { javaVersion } = this.exactJavaVersion(test.testOutput);
            if (javaVersion && testTags) {
                testData = {
                    externalTestExtraData: {
                        javaVersionOutput: javaVersion,
                        ...testTags,
                    },
                    ...testData,
                };
            }
            return {
                testData,
                ...test,
            };
        });
        return res;
    }

    extractTestTags(output) {
        let m;
        const tagRegex = new RegExp(
            'APPLICATION_NAME=(.*?)\\s+.*APPLICATION_TAG=(.*?)\\s+.*OS_TAG=(.*?)\\s+'
        );
        if ((m = tagRegex.exec(output)) !== null) {
            const appName = m[1];
            const appVersion = m[2];
            const dockerOS = m[3];
            return { appName, appVersion, dockerOS };
        }
        return null;
    }
}
module.exports = ExternalTestParser;
