export const getGitConfig = () => {
	const file = process.env.REACT_APP_CONFIG_FILE;
	
	try{
		const _config = require('../' + file);
		if(_config && _config.Git && _config.Git.user && _config.Git.password){
			return _config.Git;
		}
	} catch(e){
		console.log("Cannot find config file: ", file);
	}
	
	return null;
}