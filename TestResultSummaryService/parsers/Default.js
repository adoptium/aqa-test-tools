const Parser = require( './Parser' );

class Default extends Parser {
    static canParse() {
        return true;
    }

    parse( output ) {
        return { build: null, type: "Build", machine: this.extractMachineInfo( output ) };
    }
}

module.exports = Default;