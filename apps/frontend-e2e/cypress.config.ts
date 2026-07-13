import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      webServerCommands: {
        // Cypress only waits for the FE port (baseUrl), so the FE must not
        // come up before the API is ready — otherwise the first spec races
        // a still-booting API and fails on its first real request.
        default:
          'nx run api:serve & ' +
          'until curl -sf http://localhost:3000/api/health > /dev/null; do sleep 1; done; ' +
          'nx run frontend:serve:e2e',
        production: 'npx nx run frontend:serve-static',
      },
      ciWebServerCommand: 'npx nx run frontend:serve-static',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
