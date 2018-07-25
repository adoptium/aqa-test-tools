import React, { Component } from 'react';
import { Redirect } from 'react-router';
import { Row, Col, Input } from 'antd';
import { params } from '../utils/query';

export default class SearchOutput extends Component {
    state = {
        redirect: false,
        searchText: '',
    };

    onSearch = () => {
        this.setState( { redirect: true } );
    }

    onInputChange = e => {
        this.setState( { searchText: e.target.value } );
    }

    render() {
        const { buildId } = this.props;
        const { searchText } = this.state;

        if ( this.state.redirect ) {
            return <Redirect to={{ pathname: '/searchResult', search: params( { buildId, searchText } ) }} />;
        }

        const Search = Input.Search;

        return <div>
            <Row>
                <Col span={8} offset={16}>
                    <Search
                        style={{ margin: '10px 0' }}
                        placeholder="Search output in current build..."
                        value={this.state.searchText}
                        onChange={this.onInputChange}
                        onSearch={this.onSearch}
                    />
                </Col>
            </Row>
        </div>
    }
}