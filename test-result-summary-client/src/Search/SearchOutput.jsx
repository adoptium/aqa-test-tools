import React, { Component } from 'react';
import { Navigate } from 'react-router-dom';
import { Row, Col, Input } from 'antd';
import { params } from '../utils/query';

export default class SearchOutput extends Component {
    state = {
        redirect: false,
        searchText: '',
    };

    onSearch = () => {
        this.setState({ redirect: true }, () => {
            this.setState({ redirect: false });
        });
    };

    onInputChange = (e) => {
        this.setState({ searchText: e.target.value });
    };

    render() {
        const { buildId } = this.props;
        const { searchText } = this.state;

        const Search = Input.Search;

        return (
            <div>
                {this.state.redirect && (
                    <Navigate
                        to={{
                            pathname: '/searchResult',
                            search: params({ buildId, searchText }),
                        }}
                    />
                )}
                <Row>
                    <Col span={8} offset={16}>
                        <Search
                            style={{ margin: '10px 0' }}
                            placeholder="Search output..."
                            value={this.state.searchText}
                            onChange={this.onInputChange}
                            onSearch={this.onSearch}
                        />
                    </Col>
                </Row>
            </div>
        );
    }
}
