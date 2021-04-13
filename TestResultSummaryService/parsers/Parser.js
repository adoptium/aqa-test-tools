const {removeTimestamp} = require('../routes/utils/removeTimestamp');

class Parser {
    constructor( buildName ) {
        this.buildName = buildName;
    }

    static canParse() { return false; }

    exactJavaVersion(output) {
        const javaVersionRegex = /=JAVA VERSION OUTPUT BEGIN=[\r\n]+([\s\S]*?)[\r\n]+.*=JAVA VERSION OUTPUT END=/;
        const javaBuildDateRegex = /build.*?(([0-9]{4})-?(0[1-9]|1[012])-?(0[1-9]|[12][0-9]|3[01]))/;
        const javaOpenJDKVersionRegex = /openjdk version.*?(([0-9]{4})-?(0[1-9]|1[012])-?(0[1-9]|[12][0-9]|3[01]))/;
        const sdkResourceRegex = /.*?SDK_RESOURCE\=(.*)[\r\n]+/;
        let curRegexResult = null;
        let javaVersion, jdkDateOriginal, jdkDate, sdkResource;
        if ( ( curRegexResult = javaVersionRegex.exec( output ) ) !== null ) {
            javaVersion = removeTimestamp(curRegexResult[1]);
        }
        curRegexResult = null;
        if ( ( curRegexResult = sdkResourceRegex.exec( output) ) != null) {
            sdkResource = curRegexResult[1];
        }
        curRegexResult = null;
        // parse jdk date from javaVersion
        if ( ( curRegexResult = javaBuildDateRegex.exec( javaVersion ) ) !== null ) {
            jdkDateOriginal = curRegexResult[1];
        } else {
            curRegexResult = null;
            if ( ( curRegexResult = javaOpenJDKVersionRegex.exec( javaVersion) ) != null) {
                jdkDateOriginal = curRegexResult[1];
            }
        }
        if (jdkDateOriginal) {
            jdkDateOriginal = jdkDateOriginal.replace(/\-/g, '');
            const year = jdkDateOriginal.slice(0, 4);
            const month = jdkDateOriginal.slice(4, 6);
            const day = jdkDateOriginal.slice(6, 8);
            const date = year + "-" + month + "-" + day;
            jdkDate = new Date(date);
        }
        return { javaVersion, jdkDate, sdkResource };
    }

    exactNodeVersion(output) {
        // Example: "Node Version v13.3.1-nightly20191214b3ae532392\nRundate -20191216"
        const nodejsVersionRegex = /(Node Version[\s\S]*Rundate.*)/;
        const nodeRunDateRegex = /-(20[0-9][0-9][0-9][0-9][0-9][0-9])/;
        let curRegexResult = null;
        let nodeVersion, nodeRunDate;

        if ( ( curRegexResult = nodejsVersionRegex.exec( output ) ) !== null ) {
            nodeVersion = curRegexResult[1];
        }
        curRegexResult = null;
        // parse build run date from nodeVersion
        if ( ( curRegexResult = nodeRunDateRegex.exec( nodeVersion ) ) !== null ) {
            nodeRunDate = curRegexResult[1];
        }
        return { nodeVersion, nodeRunDate };
    }

    extractArtifact( output ) {
        let m;
        let artifact = null;
        const artifactRegex = /Test output artifactory URL:'(.*?)'/;
        if ( ( m = artifactRegex.exec( output ) ) !== null ) {
            artifact = m[1].trim();
        }
        return artifact;
    }

    extractMachineInfo( output ) {
        let m;
        let machine = null;
        const machineRegex = new RegExp( "Running on (.*?) in .*" + this.buildName );
        if ( ( m = machineRegex.exec( output ) ) !== null ) {
            machine = m[1];
        }
        return machine;
    }

    extractRerunLink (output) {
        let m;
        let rerunLink = null;
        const rerunLinkRegex = /Rerun in Grinder: (.*?)[\r\n]+/;
        if ( ( m = rerunLinkRegex.exec( output ) ) !== null ) {
            rerunLink = m[1];
        }
        return rerunLink;
    }

    extractSha (output) {
        let m;
        let releaseInfo = null;
        let openjdkSha = null;
        let openJ9Sha = null;
        let omrSha = null;
        let versions = {};

        const releaseInfoRegex = /=RELEASE INFO BEGIN=\n[\s\S]*?SOURCE="(.*)"[\s\S]*?=RELEASE INFO END=/;
        const generalOpenjdkShaRegex = /git:(.*)/;
        const openjdkShaRegex = /OpenJDK:\s?([^\s\:]*)/;
        const j9AndOmrShaRegex = /OpenJ9:\s?([^\s\:]*).*OMR:\s?([^\s\:]*)/;

        if ( ( m = releaseInfoRegex.exec( output ) ) !== null ) {
            releaseInfo = m[1];

            if ( ( m = generalOpenjdkShaRegex.exec( releaseInfo ) ) !== null ) {
                openjdkSha = m[1];
            } else if ( ( m = openjdkShaRegex.exec( releaseInfo ) ) !== null ) {
                openjdkSha = m[1];
            }

            if ( ( m = j9AndOmrShaRegex.exec( releaseInfo ) ) !== null ) {
                openJ9Sha = m[1];
                omrSha = m[2];
            }
        }
        
        if (openjdkSha) {
            versions.openjdkSha = openjdkSha
        }
        if (openJ9Sha && omrSha) {
            versions.openJ9Sha = openJ9Sha;
            versions.omrSha = omrSha;
          }
        return versions;
    }

    extractTestSummary( output ) {
        let m;
        let total = 0;
        let executed = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let disabled = 0;
        const summaryRegex = /\S*\s*?TOTAL:\s*([0-9]*)\s*EXECUTED:\s*([0-9]*)\s*PASSED:\s*([0-9]*)\s*FAILED:\s*([0-9]*)\s*DISABLED:\s*([0-9]*)\s*SKIPPED:\s*([0-9]*)\s*/;
        if ( ( m = summaryRegex.exec( output ) ) !== null ) {
            total = parseInt( m[1], 10 );
            executed = parseInt( m[2], 10 );
            passed = parseInt( m[3], 10 );
            failed = parseInt( m[4], 10 );
            disabled = parseInt( m[5], 10 );
            skipped = parseInt( m[6], 10 );
        }
        return { total, executed, passed, failed, disabled, skipped };
    }

    extractStartedBy( output ) {
        let m;
        let user = null;
        const userRegex = /Started by ?(.*?)[\r\n]+/;
        if ( ( m = userRegex.exec( output ) ) !== null ) {
            user = m[1];
        }
        return user;
    }

    convertBuildDateToUnixTime ( buildDate ) {
        let unixDate = null;
        const buildRegex = /(\d{4})(\d{2})(\d{2})/;
        const m = buildRegex.exec( buildDate )
        if ( m !== null ) {
            unixDate = Date.UTC(+m[1], m[2]-1, +m[3], 12);
        }
        return unixDate;
    }

    parse() { }
}

module.exports = Parser;
