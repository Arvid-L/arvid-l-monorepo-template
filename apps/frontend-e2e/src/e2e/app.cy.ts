describe('frontend-e2e', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('app-root').should('exist');
  });

  it('displays the app title and the example feature', () => {
    cy.contains('h1', 'Arvid L Monorepo Frontend App').should('be.visible');
    cy.contains('h1', 'Examples').should('be.visible');
    cy.contains('mat-card-title', 'Add New Example').should('be.visible');
  });

  it('creates and deletes an example through the real API', () => {
    const name = `e2e example ${Date.now()}`;

    cy.get('input[formcontrolname="name"]').type(name);
    cy.get('mat-select[formcontrolname="type"]').click();
    cy.get('mat-option').first().click();
    cy.contains('button', 'Add Example').click();

    cy.contains('td', name).should('be.visible');

    cy.on('window:confirm', () => true);
    cy.contains('tr', name).contains('button', 'delete').click();
    cy.contains('td', name).should('not.exist');
  });
});
