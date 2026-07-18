describe('Admin user management', () => {
  const ts = Date.now();
  const adminEmail = `admin-${ts}@e2e.local`;
  const userEmail = `member-${ts}@e2e.local`;
  const password = 'password-123';

  const createUser = (email: string, role?: string) =>
    cy.exec(
      `cd "$(git rev-parse --show-toplevel)" && ` +
        `npx tsx tools/scripts/create-user.ts ${email} ${password}${
          role ? ` ${role}` : ''
        }`,
    );

  it('admin can open the users page and disable an account', () => {
    createUser(adminEmail, 'admin');
    createUser(userEmail);

    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type(adminEmail);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', adminEmail).should('be.visible');

    // Toolbar link only renders for admins.
    cy.contains('a', 'Users').click();
    // Default sort createdAt desc — both fresh users are on page 1.
    cy.contains('tr', userEmail).should('be.visible');

    cy.contains('tr', userEmail).contains('button', 'Disable').click();
    cy.contains('tr', userEmail).contains('Disabled').should('be.visible');

    // The disabled user cannot log in anymore.
    cy.contains('button', 'Logout').click();
    cy.get('input[formcontrolname="email"]').type(userEmail);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('button', 'Logout').should('not.exist');
  });

  it('non-admins get redirected away from the users page', () => {
    const plainEmail = `plain-${ts}@e2e.local`;
    createUser(plainEmail);

    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type(plainEmail);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', plainEmail).should('be.visible');

    cy.visit('/admin/users');
    // adminGuard redirects to '/', which itself redirects to /examples.
    cy.location('pathname').should('eq', '/examples');
  });
});
