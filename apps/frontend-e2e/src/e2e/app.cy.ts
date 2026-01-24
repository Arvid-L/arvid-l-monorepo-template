describe('frontend-e2e', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('app-root').should('exist');
  });

  it('should display app and template title', () => {
    cy.contains('h1', 'Arvid L Monorepo Frontend App').should('be.visible');
    cy.contains('h1', 'Empty Template Component').should('be.visible');
    cy.contains('p', '{ "message": "Healthy" }').should('be.visible');
  });
});
