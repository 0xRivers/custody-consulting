import { github, installationToken, repository } from './github-app.mjs';

async function check() {
  const { repositories } = await github('/installation/repositories', await installationToken());
  if (repositories.length !== 1 || repositories[0].full_name !== repository) {
    throw new Error('The installation token was not scoped to the content repository.');
  }
  console.log(`GitHub App access verified for ${repository}.`);
}

check().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
