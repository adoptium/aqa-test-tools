// Routes benchmark name and variant combinations to the corresponding benchmark metric entry

const BenchmarkMetricRouter = {
// ##################################### PERFNEXT SPECIFIC ROUTER VALUES ################################
    "LibertyDayTrader3": {
        "17dev-4way-LargeThreadPool": "LibertyDTThroughput",
        "17dev-4way-LargeThreadPoolwarm": "LibertyDTThroughput"
    },
    "LibertyDayTrader7": {
        "17dev-4way-LargeThreadPool": "LibertyDTThroughput",
        "17dev-4way-LargeThreadPoolwarm": "LibertyDTThroughput"
    },
    "LibertyStartup": {
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "LibertyStartupAcmeAir": {
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "LibertyStartupDT": {
        "17dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-Xint-0-256-qs": "LibertyStartup"
    },
    "LibertyStartupHugeEJB": {
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "ILOG_WODM": {
        "881-4way-Seg5FastpathRVEJB": "ILOG_WODM",
        "881-4way-Seg300RulesFastpathRVEJB": "ILOG_WODM",
        "4way-Seg5FastpathRVEJB": "ILOG_WODM",
        "4way-Seg300RulesFastpathRVEJB": "ILOG_WODM"
    },
    "SPECjbb2015": {
        "multi_2grp_gencon": "SPECjbb2015"
    },
    "Crypto-BB":{
        "default": "Crypto-BB",
    },
// ##################################### PERFFARM SPECIFIC ROUTER VALUES ################################
   "CleanedLibertyStartup": {
        "9dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "CleanedLibertyStartupDT": {
        "9dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-Xint-0-256-qs": "LibertyStartup"
    },
    "CleanedLibertyStartupDT7": {
        "9dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-Xint-0-256-qs": "LibertyStartup"
    },
    "CleanedLibertyStartupHugeEJB": {
        "9dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "CleanedLibertyThroughput-DayTrader3":{
        "9dev-4way-LargeThreadPool": "LibertyDTThroughput",
        "9dev-4way-LargeThreadPoolwarm": "LibertyDTThroughput",
        "17dev-4way-LargeThreadPool": "LibertyDTThroughput",
        "17dev-4way-LargeThreadPoolwarm": "LibertyDTThroughput"
    },
    "CleanedLibertyThroughput-DayTrader7":{
        "9dev-4way-LargeThreadPool": "LibertyDTThroughput",
        "9dev-4way-LargeThreadPoolwarm": "LibertyDTThroughput",
        "17dev-4way-LargeThreadPool": "LibertyDTThroughput",
        "17dev-4way-LargeThreadPoolwarm": "LibertyDTThroughput"
    },
    "OpenLibertyStartupDT7": {
        "0": "LibertyStartup"
    },
    "bumbleBench-ArrayListSortCollectionsBench": {
        "0": "BumbleBench"
    },
    "bumbleBench-ArrayListSortComparatorBench": {
        "0": "BumbleBench"
    },
    "bumbleBench-ArrayListSortLambdaBench": {
        "0": "BumbleBench"
    },
    "SPECjbb2015GMR": {
        "multi_2grp_gencon": "SPECjbb2015"
    },
    "WebSphereStartupEE": { 
        "WAS855": "WebSphereStartup",
        "WAS9000": "WebSphereStartup"
    },
    "DayTrader30": {
        "WAS855gen1GB_4way": "DayTrader30",
        "WAS855gen1GB_4waywarm": "DayTrader30",
        "WAS9000gen1GB_4way": "DayTrader30",
        "WAS9000gen1GB_4waywarm": "DayTrader30"
    },
    "SOABBenh_10k10k": {
        "WAS855gen1GB_4way": "SOABENCH"
    },
    "Crypto-BB-v3":{
        "default": "Crypto-BB-v3",
        "IBMJCEPlus": "Crypto-BB-v3"
    },
    "WebSphereFootprint": {
        "WAS855": "WebSphereFootprint",
        "WAS9000": "WebSphereFootprint"
    },
    "WebSphereFootprintEE": {
        "WAS855": "WebSphereFootprint",
        "WAS9000": "WebSphereFootprint" 
    },
    "WebSphereStartup": { 
        "WAS855": "WebSphereStartup",
        "WAS855_2way": "WebSphereStartup",
        "WAS855_NoSec": "WebSphereStartup",
        "WAS855_NoSecXint": "WebSphereStartup",
        "WAS855_Xint": "WebSphereStartup",
        "WAS855_2way": "WebSphereStartup",
        "WAS9000": "WebSphereStartup"
    },
// ##################################### Node.JS SPECIFIC ROUTER VALUES ################################
    "AcmeAirNodejs": {
        "1grp" : "AcmeAirNodejs"
    },
}


module.exports = BenchmarkMetricRouter;