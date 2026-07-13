describe('auth flow', () => {
  const email = `e2e-user-${Date.now()}@example.org`;
  const password = 'e2e-password-123';

  it('registers a new account and lands logged in', () => {
    cy.visit('/register');

    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.get('input[formcontrolname="passwordConfirm"]').type(password);
    cy.contains('button', 'Create account').click();

    // Toolbar switches to the logged-in state
    cy.contains('.user-email', email).should('be.visible');
    cy.contains('button', 'Logout').should('be.visible');
  });

  it('logs out and back in', () => {
    // Register → logout → login with the same account (state via UI only)
    const secondEmail = `e2e-user-${Date.now()}-b@example.org`;
    cy.visit('/register');
    cy.get('input[formcontrolname="email"]').type(secondEmail);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.get('input[formcontrolname="passwordConfirm"]').type(password);
    cy.contains('button', 'Create account').click();
    cy.contains('.user-email', secondEmail).should('be.visible');

    cy.contains('button', 'Logout').click();
    cy.contains('button', 'Logout').should('not.exist');

    // logout navigates to /login — reuse the form directly
    cy.get('input[formcontrolname="email"]').type(secondEmail);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();

    cy.contains('.user-email', secondEmail).should('be.visible');
  });

  it('rejects a wrong password with an error toast', () => {
    cy.visit('/login');

    cy.get('input[formcontrolname="email"]').type('nobody@example.org');
    cy.get('input[formcontrolname="password"]').type('wrong-password');
    cy.contains('button', 'Login').click();

    // Global httpErrorInterceptor surfaces the 401 as a snackbar toast
    cy.get('simple-snack-bar').should('be.visible');
    cy.contains('button', 'Logout').should('not.exist');
  });
});
