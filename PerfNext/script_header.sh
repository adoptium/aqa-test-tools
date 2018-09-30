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

######### Run Benchmark Script Header #########
#This script is for the second job, which would be triggered after the setup is done. 
#The setup job would download and unzip the SDK and benchmark package needed to run benchmark in this job.

echo "***** Running Benchmark Script *****"

#Just for testing purposes: to be removed later
currentDir="$(pwd)"
echo "$currentDir"
echo "Current Dir: $PWD"
ls -lart

#This is where all the benchmark packages are downloaded. All downloaded SDKs exist under ./sdks
export RUN_DIR="$WORKSPACE/../../benchmarks"

#TODO: Remove these once the use of STAF has been eliminated from all the benchmark scripts 
export PATH=/usr/local/staf/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/staf/lib:$LD_LIBRARY_PATH

#Temporarily setting the SDK to this since Perfxposh doesn't have Espresso access so we have use the one that's already 
#there on the machine.
export JDK_DIR="$WORKSPACE/../../sdks"
export JDK=${buildName}

benchmark_dir="$RUN_DIR/${pkgName}"
echo "benchmark_dir: $benchmark_dir"

cd $benchmark_dir
echo "Current Dir: $(pwd)"