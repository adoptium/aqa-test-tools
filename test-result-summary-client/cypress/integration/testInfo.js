/// <reference types="cypress" />

const buildId = "60e60bf5631d857f69d62014";
const limit = 5;
const hasChildren = false;

describe("Integration test for allTestsInfo", () => {
  beforeEach(() => {
    cy.visit(
      `/allTestsInfo?buildId=${buildId}&limit=${limit}&hasChildren=${hasChildren}`
    );
  });

  it("Loads main page", () => {
    cy.contains("jdk_security4_1");
  });
});
