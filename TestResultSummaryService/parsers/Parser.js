class Parser {
    constructor( buildName ) {
        this.buildName = buildName;
    }

    static canParse() { return false; }

    extractArtifact( output ) {
        let m;
        let artifact = null;
        const artifactRegex = /Deploying artifact: ?(.*?)[\r\n]/;
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

    extractTestSummary( output ) {
        let m;
        let total = 0;
        let executed = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        const summaryRegex = /\S*\s*?TOTAL:\s*([0-9]*)\s*EXECUTED:\s*([0-9]*)\s*PASSED:\s*([0-9]*)\s*FAILED:\s*([0-9]*)\s*SKIPPED:\s*([0-9]*)\s*/;
        if ( ( m = summaryRegex.exec( output ) ) !== null ) {
            total = parseInt( m[1], 10 );
            executed = parseInt( m[2], 10 );
            passed = parseInt( m[3], 10 );
            failed = parseInt( m[4], 10 );
            skipped = parseInt( m[5], 10 );
        }
        return { total, executed, passed, failed, skipped };
    }

    extractStartedBy( output ) {
        let m;
        let user = null;
        const userRegex = /Started by ?(.*?)[\r\n]/;
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