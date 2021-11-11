const Parser = require('./Parser');
const Utils = require(`./Utils`);
const decompress = require("decompress");
const path = require('path');

class Tap extends Parser {
    static canParse(filePath) {
        const path = require('path')
        if (filePath) {
            if (path.extname(filePath) == '.zip') {
                return true;
            } 
        } else {
            return false;
        }
    }

    static async parse(filePath) {
      const files = await decompress(filePath,  "dist");
      console.log(files);
      console.log(files[0].path);
      
    }

    async extract(str) {
        pass
    }
}

module.exports = Tap;