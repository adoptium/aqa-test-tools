import React, { Component } from 'react';
import { Button, Icon, Checkbox } from 'antd';
import ServerSelector from "./ServerSelector";

const map = {
    InternalJenkins: {
        url: "https://customJenkinsServer",
        builds: [
            "Daily-ODM",
            "Daily-SPECjbb2015",
            "Daily-Liberty-DayTrader3",
            "daily_openjdk8_j9_jcktest_ppc64le_linux",
            "daily_openjdk8_j9_jcktest_x86-64_linux",
            "daily_openjdk9_j9_jcktest_ppc64le_linux",
            "daily_openjdk9_j9_jcktest_x86-64_linux",
        ],
        default: [
            "daily_openjdk8_j9_jcktest_ppc64le_linux",
            "daily_openjdk8_j9_jcktest_x86-64_linux",
            "daily_openjdk9_j9_jcktest_ppc64le_linux",
            "daily_openjdk9_j9_jcktest_x86-64_linux",
        ]
    },
    OpenJ9: {
        url: "https://ci.eclipse.org/openj9/",
        builds: [
            "Pipeline-Build-Test-All",
            "Pipeline-Build-Test-JDK8-linux_390-64_cmprssptrs",
            "Pipeline-Build-Test-JDK8-linux_ppc-64_cmprssptrs_le",
            "Pipeline-Build-Test-JDK9-linux_390-64_cmprssptrs",
            "Pipeline-Build-Test-JDK9-linux_ppc-64_cmprssptrs_le",
            "Test-Extended-JDK8-linux_390-64_cmprssptrs",
            "Test-Extended-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-Extended-JDK9-linux_390-64_cmprssptrs",
            "Test-Extended-JDK9-linux_ppc-64_cmprssptrs_le",
            "Test-Sanity-JDK8-linux_390-64_cmprssptrs",
            "Test-Sanity-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-Sanity-JDK9-linux_390-64_cmprssptrs",
            "Test-Sanity-JDK9-linux_ppc-64_cmprssptrs_le",
            "Test-Sanity-linux_390-64_cmprssptrs",
            "Test-Sanity-linux_ppc-64_cmprssptrs_le",
        ],
        default: [
            "Pipeline-Build-Test-All",
            "Pipeline-Build-Test-JDK8-linux_390-64_cmprssptrs",
            "Pipeline-Build-Test-JDK8-linux_ppc-64_cmprssptrs_le",
            "Pipeline-Build-Test-JDK9-linux_390-64_cmprssptrs",
            "Pipeline-Build-Test-JDK9-linux_ppc-64_cmprssptrs_le",
        ]
    },
    AdoptOpenJDK: {
        url: "https://ci.adoptopenjdk.net/",
        builds: [
            "openjdk8_hs_openjdktest_x86-64_linux",
            "openjdk8_hs_openjdktest_x86-64_macos",
            "openjdk8_j9_openjdktest_x86-64_linux",
            "openjdk9_hs_openjdktest_aarch64_linux",
            "openjdk9_j9_openjdktest_x86-64_linux",
            "openjdk8_hs_systemtest_ppc64le_linux",
            "openjdk8_hs_systemtest_x86-64_linux",
        ],
        default: [
            "openjdk8_j9_openjdktest_x86-64_linux",
            "openjdk8_hs_openjdktest_x86-64_linux"
        ]
    }
};

const getList = ( selected, serverSelected ) => {
    return selected[serverSelected] || map[serverSelected].default || map[serverSelected].builds;
}

export class BuildStatusSetting extends Component {
    onChange = list => {
        const { selected, serverSelected } = this.props;
        this.props.onChange( {
            selected: {
                ...selected,
                [serverSelected]: list,
            }
        } );
    }
    onServerChange = obj => {
        this.props.onChange( { serverSelected: obj.target.value } );
    }

    render() {
        const { selected = {}, serverSelected } = this.props;
        const obj = map[serverSelected] || [];

        const options = obj.builds.map( buildName => {
            return {
                label: buildName, value: buildName
            };
        } );

        const list = getList( selected, serverSelected );
        return <div style={{ maxWidth: 400 }}>
            <ServerSelector servers={Object.keys( map )} serverSelected={serverSelected} onChange={this.onServerChange} />
            {serverSelected && <Checkbox.Group options={options} value={list} onChange={this.onChange} />}
        </div>
    }
}

export default class BuildStatus extends Component {
    static Title = props => {
        return props.serverSelected;
    };
    static Setting = BuildStatusSetting;
    static defaultSize = { w: 2, h: 2 }
    static defaultSettings = {
        serverSelected: "OpenJ9"
    }

    state = {
        builds: {},
    };

    async componentDidMount() {
        await this.updateData();
        // update every 30 secs
        this.intervalId = setInterval(() => {
            this.updateData( true );
        }, 30 * 1000 );
    }

    async componentDidUpdate() {
        await this.updateData();
    }

    componentWillUnmount() {
        clearInterval( this.intervalId );
    }

    updateData = async ( force = false ) => {
        const { selected = {}, serverSelected } = this.props;
        if ( !serverSelected ) return;
        const list = getList( selected, serverSelected );
        await Promise.all( list.map( async buildName => {
            const url = map[serverSelected].url;
            if ( force || !this.state.builds[buildName] ) {
                const encodeUrl = encodeURIComponent( url );
                const response = await fetch( `/api/getLastBuildInfo?url=${encodeUrl}&buildName=${buildName}`, {
                    method: 'get'
                } );
                const data = await response.json();
                let result = null;
                let buildNum = null;
                let buildUrl = null;
                if ( data && data.result ) {
                    if ( data.result.building ) {
                        result = "Running";
                    } else {
                        result = data.result.result;
                    }
                    buildUrl = data.result.url;
                    buildNum = data.result.number;
                } else {
                    buildUrl = url + "/job/" + buildName;
                }
                this.state.builds[buildName] = {
                    buildName,
                    result,
                    url: buildUrl,
                    buildNum,
                };
                this.setState( this.state.builds );
            }
        } ) );
    }

    getIcon( build ) {
        const buildInfo = build.buildName + " #" + build.buildNum;
        if ( build.result === "SUCCESS" ) {
            return <div>{buildInfo} <Icon type="check" style={{ fontSize: 16, color: '#43ed2d' }} /></div>;
        } else if ( build.result === "Running" ) {
            return <div>{buildInfo} {build.result} <Icon type="loading" style={{ fontSize: 16, color: '#43ed2d' }} /></div>;
        } else if ( build.result === "FAILURE" ) {
            return <div>{buildInfo} <Icon type="close" style={{ fontSize: 16, color: '#f50' }} /></div>;
        } else if ( build.result === null ) {
            return <div>{build.buildName} <b>cannot connect or disabled</b> <Icon type="question" style={{ fontSize: 16, color: '#DAA520' }} /></div>;
        } else {
            return <div>{buildInfo} {build.result} <Icon type="info" style={{ fontSize: 16, color: '#DAA520' }} /></div>;
        }
    }

    render() {
        const { builds } = this.state;
        const { selected = {}, serverSelected } = this.props;
        const list = getList( selected, serverSelected );
        if ( builds && list ) {
            return list.map( listItem => {
                const build = builds[listItem];
                if ( !build ) return null;
                return <a key={build.buildName} href={build.url} target="_blank">
                    <Button style={{ marginRight: 8, marginBottom: 4 }}>{this.getIcon( build )}</Button>
                </a>
            } );
        }
        return null;
    }
}