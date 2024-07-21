const { removeTimestamp } = require('../routes/utils/removeTimestamp');

class Parser {
    constructor(buildName) {
        this.buildName = buildName;
    }

    static canParse() {
        return false;
    }

    exactJavaVersion(output) {
        const javaVersionRegex =
            /=JAVA VERSION OUTPUT BEGIN=[\r\n]+([\s\S]*?)[\r\n]+.*=JAVA VERSION OUTPUT END=/;
        const javaBuildDateRegex =
            /(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/; // Captures dates in the format YYYY-MM-DD
        const sdkResourceRegex = /.*?SDK_RESOURCE\=(.*)[\r\n]+/;
        let curRegexResult = null;
        let javaVersion, jdkDate, sdkResource;

        if ((curRegexResult = javaVersionRegex.exec(output)) !== null) {
            javaVersion = removeTimestamp(curRegexResult[1]);
        } else {
            javaVersion = output;  // Use the entire output if markers are missing
        }

        curRegexResult = null;
        if ((curRegexResult = sdkResourceRegex.exec(output)) != null) {
            sdkResource = curRegexResult[1];
        }
        curRegexResult = null;

        // parse jdk date from javaVersion or output
        if ((curRegexResult = javaBuildDateRegex.exec(javaVersion)) !== null) {
            jdkDate = curRegexResult[0];
        } else if ((curRegexResult = javaBuildDateRegex.exec(output)) !== null) {
            jdkDate = curRegexResult[0];
        }

        // Refine jdkDate extraction to match specific lines for HotSpot, OpenJ9, and Java 8 implementations
        if (!jdkDate) {
            // Try to extract date from specific lines for HotSpot
            const hotspotBuildDateRegex =
                /OpenJDK Runtime Environment [^ ]+ \([^)]+ (\d{4})(\d{2})(\d{2})/; // e.g., 20240626
            const openj9BuildDateRegex =
                /Eclipse OpenJ9 VM \([^)]+ (\d{4})(\d{2})(\d{2})/; // e.g., 20240627
            const java8BuildDateRegex =
                /OpenJDK Runtime Environment.*\(build [^\d]*(\d{4})(\d{2})(\d{2})/; // e.g., 1.8.0_412-b08

            if ((curRegexResult = hotspotBuildDateRegex.exec(output)) !== null) {
                jdkDate = `${curRegexResult[1]}-${curRegexResult[2]}-${curRegexResult[3]}`;
            } else if ((curRegexResult = openj9BuildDateRegex.exec(output)) !== null) {
                jdkDate = `${curRegexResult[1]}-${curRegexResult[2]}-${curRegexResult[3]}`;
            } else if ((curRegexResult = java8BuildDateRegex.exec(output)) !== null) {
                jdkDate = `${curRegexResult[1]}-${curRegexResult[2]}-${curRegexResult[3]}`;
            }
        }

        return { javaVersion, jdkDate, sdkResource };
    }

    exactNodeVersion(output) {
        const nodejsVersionRegex = /(Node Version[\s\S]*Rundate.*)/;
        const nodeRunDateRegex = /-(20[0-9][0-9][0-9][0-9][0-9][0-9])/;
        let curRegexResult = null;
        let nodeVersion, nodeRunDate;

        if ((curRegexResult = nodejsVersionRegex.exec(output)) !== null) {
            nodeVersion = curRegexResult[1];
        }
        curRegexResult = null;
        if ((curRegexResult = nodeRunDateRegex.exec(nodeVersion)) !== null) {
            nodeRunDate = curRegexResult[1];
        }
        return { nodeVersion, nodeRunDate };
    }

    extractArtifact(output) {
        let m;
        let artifact = null;
        const artifactRegex = /Test output artifactory URL:'(.*?)'/;
        if ((m = artifactRegex.exec(output)) !== null) {
            artifact = m[1].trim();
        }
        return artifact;
    }

    extractMachineInfo(output) {
        let m;
        let machine = null;
        const machineRegex = new RegExp(
            'Running on (.*?) in .*' + this.buildName
        );
        if ((m = machineRegex.exec(output)) !== null) {
            machine = m[1];
        }
        return machine;
    }

    extractRerunLink(output) {
        let m;
        let rerunLink = null;
        const rerunLinkRegex = /Rerun in Grinder: (.*?)[\r\n]+/;
        if ((m = rerunLinkRegex.exec(output)) !== null) {
            rerunLink = m[1];
        }
        return rerunLink;
    }

    extractRerunFailedLink(output) {
        let m;
        let rerunFailedLink = null;
        const rerunFailedLinkRegex =
            /Rerun in Grinder with failed test targets: (.*?)[\r\n]+/;
        if ((m = rerunFailedLinkRegex.exec(output)) !== null) {
            rerunFailedLink = m[1];
        }
        return rerunFailedLink;
    }

    extractSha(output) {
        let m;
        let releaseInfo = null;
        let openjdkSha = null;
        let openJ9Sha = null;
        let omrSha = null;
        let versions = {};

        const releaseInfoRegex =
            /=RELEASE INFO BEGIN=\n[\s\S]*?SOURCE="(.*)"\n[\s\S]*?=RELEASE INFO END=/;
        const generalOpenjdkShaRegex = /git:(.*)/;
        const openjdkShaRegex = /OpenJDK:\s?([^\s\:]*)/;
        const j9AndOmrShaRegex = /OpenJ9:\s?([^\s\:]*).*OMR:\s?([^\s\:]*)/;

        if ((m = releaseInfoRegex.exec(output)) !== null) {
            releaseInfo = m[1];

            if ((m = generalOpenjdkShaRegex.exec(releaseInfo)) !== null) {
                openjdkSha = m[1];
            } else if ((m = openjdkShaRegex.exec(releaseInfo)) !== null) {
                openjdkSha = m[1];
            }

            if ((m = j9AndOmrShaRegex.exec(releaseInfo)) !== null) {
                openJ9Sha = m[1];
                omrSha = m[2];
            }
        }

        if (openjdkSha) {
            versions.openjdkSha = openjdkSha;
        }
        if (openJ9Sha && omrSha) {
            versions.openJ9Sha = openJ9Sha;
            versions.omrSha = omrSha;
        }
        return versions;
    }

    extractTestSummary(output) {
        let m;
        let total = 0;
        let executed = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let disabled = 0;
        const summaryRegex =
        /\S*\s*?TOTAL:\s*([0-9]*)\s*EXECUTED:\s*([0-9]*)\s*PASSED:\s*([0-9]*)\s*FAILED:\s*([0-9]*)\s*DISABLED:\s*([0-9]*)\s*SKIPPED:\s*([0-9]*)\s*(\r\n|\r|\n)/;
        if ((m = summaryRegex.exec(output)) !== null) {
            total = parseInt(m[1], 10);
            executed = parseInt(m[2], 10);
            passed = parseInt(m[3], 10);
            failed = parseInt(m[4], 10);
            disabled = parseInt(m[5], 10);
            skipped = parseInt(m[6], 10);
        }
        return { total, executed, passed, failed, disabled, skipped };
    }

    extractStartedBy(output) {
        let m;
        let user = null;
        const userRegex = /Started by ?(.*?)[\r\n]+/;
        if ((m = userRegex.exec(output)) !== null) {
            user = m[1];
        }
        return user;
    }

    convertBuildDateToUnixTime(buildDate) {
        let unixDate = null;
        const buildRegex = /(\d{4})(\d{2})(\d{2})/;
        const m = buildRegex.exec(buildDate);
        if (m !== null) {
            unixDate = Date.UTC(+m[1], m[2] - 1, +m[3], 12);
        }
        return unixDate;
    }

    parse() {}
}

module.exports = Parser;
