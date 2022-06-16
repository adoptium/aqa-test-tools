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
			echo "Update TRSS client..."
			cd test-result-summary-client
			echo "npm ci --production"
			npm ci --production
			echo "npm run build"
			CI=false npm run build
			echo "Update TRSS server..."
			cd ../TestResultSummaryService
			echo "npm ci --production"
			npm ci --production
	'''
	}
}