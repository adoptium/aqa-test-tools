const Parser = require('./Parser');

//ToDo: this is a place holder for build
class Build extends Parser {
    static canParse(buildName, output) {
        return (
            buildName.match(/^Build-/) ||
            buildName.match(/IBMJAVA-build/) ||
            buildName.match(/source/i) ||
            buildName.match(/compile/i) ||
            buildName.match(/compose/i)
        );
    }

    parse(output) {
        return {
            build: null,
            type: 'Build',
            machine: this.extractMachineInfo(output),
        };
    }
}

module.exports = Build;
