/// <reference types="cypress" />

describe('Integration test for allTestsInfo', () => {
    const buildId = '60e60bf5631d857f69d62014';
    const limit = 1;
    const hasChildren = false;

    beforeEach(() => {
        cy.visit(
            `/allTestsInfo?buildId=${buildId}&limit=${limit}&hasChildren=${hasChildren}`
        );
    });

    it('Loads main page', () => {
        // Loads header elements
        cy.get('.ant-breadcrumb').contains(
            'Test_openjdk11_hs_extended.openjdk_x86-64_linux_testList_0 #6'
        );
        cy.get('.ant-input-wrapper')
            .find('input')
            .should('have.attr', 'placeholder', 'Search output...');

        // Loads table elements
        cy.get('.ant-table').contains('Tests');
        cy.get('.ant-table-thead').find('th').eq(0).contains('Test Name');
        cy.get('.ant-table-thead').find('th').eq(1).contains('Action');
        cy.get('.ant-table-thead').find('th').eq(2).contains('Duration');
        cy.get('.ant-table-thead').find('th').eq(3).contains('Machine');

        cy.get('.ant-table-thead')
            .find('th')
            .eq(0)
            .find('.ant-dropdown-trigger')
            .should('have.attr', 'role', 'button');
        cy.get('.ant-table-thead')
            .find('th')
            .eq(3)
            .find('.ant-dropdown-trigger')
            .should('have.attr', 'role', 'button');

        cy.contains('jdk_security4_1');
    });
});
