#!groovy

def TRSS_NODE = params.TRSS_NODE ?: "ci.role.trss"

node(TRSS_NODE) {

	def TRSS_WORKSPACE = params.TRSS_WORKSPACE ?: "$WORKSPACE/aqa-test-tools"
	if(!fileExists("$TRSS_WORKSPACE")) {
		assert false : "TRSS_WORKSPACE ${TRSS_WORKSPACE} does not exist!"
	}
	echo "Sync code in TRSS server"
	dir("$TRSS_WORKSPACE") {
		sh "pwd"
		sh '''
			git pull
			echo "Stop TRSS components..."
			echo "npm run docker-down"
			npm run docker-down
			echo "Restart TRSS components..."
			echo "npm run docker"
			npm run docker
	'''
	}
}