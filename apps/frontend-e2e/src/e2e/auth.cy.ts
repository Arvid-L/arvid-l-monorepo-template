describe('auth flow', () => {
  const password = 'e2e-password-123';

  // Creates a verified user directly in the DB (create-user.ts marks
  // accounts verified) — the only way to get past the hard gate without
  // clicking a mail link. The e2e web server runs `nx run api:serve`
  // (development config), so the script's .env.dev fallback targets the
  // same DB the API under test uses.
  const createVerifiedUser = (email: string) =>
    cy.exec(
      `cd "$(git rev-parse --show-toplevel)" && ` +
        `npx tsx tools/scripts/create-user.ts ${email} ${password}`,
    );

  it('registration ends on the check-your-inbox screen, not logged in', () => {
    const email = `e2e-user-${Date.now()}@example.org`;
    cy.visit('/register');

    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.get('input[formcontrolname="passwordConfirm"]').type(password);
    cy.get('mat-checkbox').click();
    cy.contains('button', 'Create account').click();

    cy.contains('Check your inbox').should('be.visible');
    cy.contains('button', 'Resend mail').should('be.visible');
    cy.contains('button', 'Logout').should('not.exist');
  });

  it('unverified login is rejected with a resend option', () => {
    const email = `e2e-unverified-${Date.now()}@example.org`;
    cy.visit('/register');
    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.get('input[formcontrolname="passwordConfirm"]').type(password);
    cy.get('mat-checkbox').click();
    cy.contains('button', 'Create account').click();
    cy.contains('Check your inbox').should('be.visible');

    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();

    cy.contains('button', 'Resend verification mail').should('be.visible');
    cy.contains('button', 'Logout').should('not.exist');
  });

  it('a verified user can log in, out, and back in', () => {
    const email = `e2e-verified-${Date.now()}@example.org`;
    createVerifiedUser(email);

    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', email).should('be.visible');

    cy.contains('button', 'Logout').click();
    cy.contains('button', 'Logout').should('not.exist');

    // logout navigates to /login — reuse the form directly
    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', email).should('be.visible');
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

  it('shows the error state for a garbage verification token', () => {
    cy.visit('/verify-email?token=garbage');
    cy.contains('Link invalid or expired').should('be.visible');
    cy.contains('button', 'Resend verification mail').should('be.visible');
  });
});
