/// <reference types="cypress" />

describe('Integration test with visual testing', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('Loads main page', () => {
    cy.contains("Test_openjdk11_hs_extended.openjdk_x86-64_linux")
    cy.contains("Failed: 6 Passed: 40 Disabled: 21 Skipped: 29 Total: 96")
  })

  it('Loads Grid view', () => {
    cy.contains("Grid").click()
    cy.contains("Test_openjdk11_hs_extended.openjdk_x86-64_linux #31")
    cy.contains("Test Summary")
    cy.contains("Passed: 40")
  })
})
