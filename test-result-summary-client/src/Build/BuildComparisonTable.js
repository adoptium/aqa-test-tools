import React, { Component } from 'react';
import { CheckOutlined, CloseOutlined, InfoOutlined, LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Table, Tooltip, Checkbox, Popconfirm } from 'antd';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';
import { fetchData, timeConversion } from '../utils/Utils';
import BuildLink from './BuildLink';
import { components } from "react-select";
import { default as ReactSelect } from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const Option = (props) => {
  return (
    <div>
      <components.Option {...props}>
        <input
          type="checkbox"
          checked={props.isSelected}
          onChange={() => null}
        />{" "}
        <label>{props.label}</label>
      </components.Option>
    </div>
  );
};

const pageSize = 5;
export default class BuildCompare extends Component {

    state = {
        currentPage: 1,
        buildInfo: [],
	startDate: new Date(1610188860945), // earlier this year for demo
	endDate: new Date(),
	optionSelected: [{value: 'Select', label: 'select'}],
	allColumns: [
	{
            value: 'Select',
            label: 'select',
        }, {
            value: 'Build',
            label: 'build',
        }, {
            value: 'JDK Implementation',
            label: 'impl',
        }, {
            value: 'JDK Version',
            label: 'version',
        }, {
            value: 'Start Date',
            label: 'date',
        }, {
            value: 'Platforms',
            label: 'platform',
        },  {
            value: 'Vendor',
            label: 'vendor',
        }, {
            value: 'Duration',
            label: 'time',
        }
	]
    };

    async componentDidMount() {
        await this.updateData();
    }

    async componentDidUpdate(prevProps, prevState) {
        if (prevProps.url !== this.props.url) {
            await this.updateData();
        }

        if (prevState.currentPage !== this.state.currentPage) {
            await this.updateTotals();
        }
    }

    retrieveParams(buildParams) {
	var params = {}
    	buildParams.forEach((dict)=> params[dict.name] = dict.value)
	return params
    }

    async updateData() {
        const { buildUrlList } = this.props;
        // consolidates all build information into the buildsList array
        const buildsList = []
        for (let i = 0; buildUrlList && i < buildUrlList.length; i++) {
            const buildName = buildUrlList[i][0];
            const url = buildUrlList[i][1];
            const builds = await fetchData(`/api/getBuildHistory?buildName=${buildName}&url=${url}&limit=120`);
            for (let j = 0; builds && j < builds.length; j++) {
                buildsList.push(builds[j]);
            }
        }
        const info = buildsList.map(build => {
            const params = this.retrieveParams(build.buildParams)
            const date = build.timestamp ? new Date(build.timestamp) : null
            return {
                key: build._id,
                build: build,
                date: (date > this.state.startDate && date < this.state.endDate) ? date.toLocaleString() : null,
                vendor: "N/A",
                impl: params.JDK_IMPL,
            version: params.JDK_VERSION,
            platform: params.PLATFORM,
            time: timeConversion(build.buildDuration)
        }});
    
        const buildInfo = info.filter(build => build.date)
        this.setState({ buildInfo });
    
        await this.updateTotals();
    }

    async updateTotals() {
        let { buildInfo, currentPage } = this.state;
        if (buildInfo) {
            const { buildName, url } = this.props;
            // only query getTotals if buildInfo does not have the data
            const i = pageSize * (currentPage - 1);

            await Promise.all(buildInfo.slice(i, pageSize * currentPage).map(async build => {
                if (build.totals) return;
                const totals = await fetchData(`/api/getTotals?buildName=${buildName}&url=${url}&buildNum=${build.build.buildNum}`);
                build.totals = totals;
            }));
            this.forceUpdate();
        }
    }

    onChange = page => {
        this.setState({
            currentPage: page,
        });
    };

    handleChange = (selected) => {
      this.setState({
        optionSelected: selected
      });
    };

    editColumns = () =>{
	var options = this.state.allColumns;
   	return <ReactSelect
	  options={options}
	  isMulti
	  closeMenuOnSelect={false}
	  hideSelectedOptions={false}
	  components={{
	    Option
	  }}
	  onChange={this.handleChange}
	  allowSelectAll={true}
	  value={this.state.optionSelected}
	/>
    };

    async setStartDate (startDate){
	this.setState({startDate})
        await this.updateData();
    }

    async setEndDate(endDate){
	this.setState({endDate})
        await this.updateData();
    }

    dateRangePicker = () =>{
	return <div>
	  <b>Date Range: </b>
     	  <DatePicker
     	    selected={this.state.startDate}
     	    selectsStart
     	    startDate={this.state.startDate}
     	    endDate={this.state.endDate}
     	    onChange={date => this.setStartDate(new Date(date))}
     	  />
     	  <DatePicker
     	    selected={this.state.endDate}
     	    selectsEnd
     	    startDate={this.state.startDate}
     	    endDate={this.state.endDate}
     	    minDate={this.state.startDate}
     	    onChange={date => this.setEndDate(new Date(date))}
     	  />
	</div>
    }

    render() {
        const { buildInfo } = this.state;
        const { buildName, url, type } = this.props;
        if (buildInfo) {
            const renderFvTestBuild = (value) => {
                if (value && value.buildNum) {
                    let icon = "";
                    if (value.status !== "Done") {
                        icon = <LoadingOutlined style={{ fontSize: 16, color: '#DAA520' }} />;
                        value.buildResult = "PROGRESSING"
                    } else if (value.buildResult === "SUCCESS") {
                        icon = <CheckOutlined style={{ fontSize: 16, color: '#2cbe4e' }} />;
                    } else if (value.buildResult === "FAILURE") {
                        icon = <CloseOutlined style={{ fontSize: 16, color: '#f50' }} />;
                    } else {
                        icon = <InfoOutlined style={{ fontSize: 16, color: '#f50' }} />;
                    }
                    return <div>
                        <Link to={{ pathname: '/buildDetail', search: params({ parentId: value._id }) }}
                            style={{ color: value.buildResult === "SUCCESS" ? "#2cbe4e" : (value.buildResult === "FAILURE" ? "#f50" : "#DAA520") }}>Build #{value.buildNum}  <Tooltip title={value.buildResult}>{icon}</Tooltip>
                        </Link>

                        <br />{renderPublishName(value)}
                    </div>
                }
                return null;
            };

            const renderBuild = (value) => {
                if (value && value.buildNum) {
                    let result = value.buildResult;
                    if (value.tests && value.tests.length > 0) {
                        result = value.tests[0].testResult;
                        if (value.tests[0]._id) {
                            return <div>
                                <Link to={{ pathname: '/output/test', search: params({ id: value.tests[0]._id }) }}
                                    style={{ color: result === "PASSED" ? "#2cbe4e" : (result === "FAILED" ? "#f50" : "#DAA520") }}>
                                    Build #{value.buildNum}
                                </Link>
                            </div>;
                        }
                    } else {
                        return <div>
                            <Link to={{ pathname: '/buildDetail', search: params({ parentId: value._id }) }}
                                style={{ color: result === "SUCCESS" ? "#2cbe4e" : (result === "FAILURE" ? "#f50" : "#DAA520") }}> Build #{value.buildNum}
                            </Link>
                        </div>;
                    }
                }
                return null;
            };

            const renderBuildResults = (value) => {
                return <div>
                    <BuildLink id={value._id} link={value.buildName} buildResult={value.buildResult} />
                </div>;
            };

            const renderPublishName = ({ buildParams = [] }) => {
                if (buildParams) {
                    const param = buildParams.find(param => param.name === "overridePublishName");
                    if (param)
                        return param.value;
                }
                return;
            };

	    const columns=[
	    {
                title: 'Select',
                dataIndex: 'select',
                key: 'select',
                render: (value, record) => {
                    return <Popconfirm>
                        <Checkbox checked={value}></Checkbox>
                    </Popconfirm>
                }
            }, {
                title: 'Build',
                dataIndex: 'build',
                key: 'buildName',
                render: renderBuildResults,
            }, {
                title: 'Vendor',
                dataIndex: 'vendor',
                key: 'vendorName',
            }, {
                title: 'JDK Implementation',
                dataIndex: 'impl',
                key: 'impl',
            }, {
                title: 'Platforms',
                dataIndex: 'platform',
                key: 'platform',
            }, {
                title: 'JDK Version',
                dataIndex: 'version',
                key: 'version',
                sorter: (a, b) => {
                    return a.version.localeCompare(b.version);
                }
            }, {
                title: 'Start Date',
                dataIndex: 'date',
                key: 'date',
                sorter: (a, b) => {
                    return a.date.localeCompare(b.date);
                },
            },  {
                title: 'Duration',
                dataIndex: 'time',
                key: 'time',
                sorter: (a, b) => {
                    return a.time.localeCompare(b.time);
                }
            }
	    ];

	    const getOptions =() => {
	    	var activeOptions = [];
		if (this.state.optionSelected.length < 2) {
		   const optionSelected = this.state.allColumns.slice(0,5)
		   this.setState({ optionSelected })
		}
            	columns.forEach(c => {
	    	    this.state.optionSelected.forEach(col => {
	    	        if (col.value === c.title) { activeOptions.push(c)}
	    	    })
	    	})
		return activeOptions
	    }
            return <div>
			{this.dateRangePicker()}
			{this.editColumns()}
			<Table
			columns={getOptions()}
	                dataSource={buildInfo}
	                pagination={{ pageSize, onChange: this.onChange }}
	                />;
		</div>
        } else {
            return null;
        }
    }
}
