import React, { Component } from 'react';

import { getParams } from '../utils/query';
import TopLevelBuildTable from './TopLevelBuildTable';

export default class Builds extends Component {
    render() {
        const { buildName, url, type } = getParams(this.props.location.search);

        return (
            <TopLevelBuildTable url={url} buildName={buildName} type={type} />
        );
    }
}
