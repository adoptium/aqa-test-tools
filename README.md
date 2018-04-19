# openjdk-test-tools
Tools that enhance the ability to monitor, triage, configure the different type of tests we run at AdoptOpenJDK.   These tools are not a test framework, (such as stf which is the framework used to run system tests).  

These tools include:
* PerfNext - a way to configure, tune and launch performance benchmarks to Jenkins servers
* Test Results Summary Service - helps summarize different Jenkins jobs, providing additional features that a simple Jenkins plugin may not (including the ability to monitor multiple Jenkins servers, push different sets of test results to a database, search test and compare results across different platforms, report on differences between jobs, etc).

These tools are a 'work in progress', and a platform for adding other tools and services.  The intent is to create a highly customizable toolset to aid developers in testing and delivering high quality code.  
