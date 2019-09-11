#!/bin/bash +x
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

######### Setup SDK & Benchmark Package Script #########

#This is the setup script, which would download and unzip selected SDK and benchmark package.
#Both the downloaded packages will be used by the next job to run the benchmark.

echo "***** Running Setup SDK & Benchmark Package Script *****"

echo "Benchmark Name: ${benchmarkName} Benchmark Variant: ${benchmarkVariant}"

#Just for testing purposes: to be removed later
currentDir="$(pwd)"
echo "$currentDir"
echo "Current Dir: $PWD"
ls -lart

#This is where all the benchmark packages are downloaded. All downloaded SDKs exist under ./sdks
export RUN_DIR="$WORKSPACE/../../benchmarks"
export BENCHMARK_DIR="$RUN_DIR/${pkgName}"
export JDK_DIR="$WORKSPACE/../../sdks"
export SDK="$JDK_DIR/${buildName}"

if [ ! -d "$RUN_DIR" ]; then
	mkdir -p $RUN_DIR
	echo "Created a $RUN_DIR directory"
else
  echo "$RUN_DIR directory already exists"
fi

cd $RUN_DIR
echo "Current Dir: $(pwd)"

if [ ! -d "$BENCHMARK_DIR" ]; then
	#Get benchmark and unzip
	echo "Downloading Benchmark since it doesn't already exist on the machine"
	curl -knOs -u $PERFMAN_W3_USERNAME:$PERFMAN_W3_PASSWORD ${packageURL}
	echo "Unzipping Benchmark"
	${benchmarkExtractCmd}	
	chmod -R 755 ${pkgName}
else
  echo "$BENCHMARK_DIR already exists, hence not downloading it"
fi

if [ ! -d "$JDK_DIR" ]; then
	mkdir -p $JDK_DIR
else
  echo "$JDK_DIR directory already exists"
fi

cd $JDK_DIR
echo "Current Dir: $(pwd)"
echo "buildName=${buildName}"


#TODO: Enable this once we add another machine such as Perffarm, which has acccess to Espresso
#Currently, there is only one Perf machine, Perfxposh, which can't access Espresso due to firewall so commenting this out

if [ ! -d "$SDK" ]; then
	echo "Downloading SDK since it doesn't already exist on the machine"
	${buildSetupCmds}
else
	echo "SDK ${buildName} already exists, hence not downloading it"
fi
