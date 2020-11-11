const Parser = require( './Parser' );

const regexOpenJ9 = /OPENJ9_SHA\s?:\s?(.*?)\r/;
const regexOpenJdk = /OPENJDK_SHA\s?:\s?(.*?)\r/;
const regexOmr = /OMR_SHA\s?:\s?(.*?)\r/;
const regexBuilds = /(\[(.*?)\])?Starting building: (.*?) ?#(\d*)/g;

class ParentBuild extends Parser {
    static canParse( buildName, output ) {
        if (output) {
            return output.includes( "Starting building:" );
        } else {
            return false;
        }
    }
    parse( output ) {
        let openJ9Sha = null;
        let openJdkSha = null;
        let omrSha = null;
        let m = null;
        const builds = [];
        let buildData = {};
        if ( ( m = regexOpenJ9.exec( output ) ) !== null ) {
            buildData.openJ9Sha = m[1];
        }
        if ( ( m = regexOpenJdk.exec( output ) ) !== null ) {
            buildData.openJdkSha = m[1];
        }
        if ( ( m = regexOmr.exec( output ) ) !== null ) {
            buildData.omrSha = m[1];
        }
        regexBuilds.lastIndex = 0;
        let allBuilds = [];
        while ( ( m = regexBuilds.exec( output ) ) !== null ) {
            allBuilds = m[3].split(" » ");
            const buildName = allBuilds[allBuilds.length - 1];
            allBuilds.pop();
            let url = allBuilds.join("/job/");
            if (allBuilds.length > 1 && url.length > 0) {
                url = "/job/" + url;
            }
            const buildNameStr = m[1] ? m[1] : buildName;
            let type = "Build";
            if ( buildName.match( /^Test-/ ) ) {
                type = "Test";
            } else if (buildName.match(/^PerfNext/)) {
                type = "Perf";
            }
            builds.push( {
                url,
                buildNameStr,
                buildName,
                buildNum: m[4],
                type
            } );
        }
        return {
            builds,
            buildData,
            machine: this.extractMachineInfo( output ),
            startBy: this.extractStartedBy( output ),
            artifactory: this.extractArtifact( output ),
        };
    }
}

module.exports = ParentBuild;