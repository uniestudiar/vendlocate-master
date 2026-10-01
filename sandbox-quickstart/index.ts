import { config } from 'dotenv';
import { Sandbox } from '@vercel/sandbox';

config({ path: '.env.local' });

if (!process.env.VERCEL_OIDC_TOKEN) {
  throw new Error('VERCEL_OIDC_TOKEN is missing. Run `npx vercel@latest env pull .env.local --yes` after linking the project.');
}

const sandbox = await Sandbox.getOrCreate({
  name: 'my-sandbox-460643',
  persistent: true,
  networkPolicy: 'deny-all',
});

try {
  await sandbox.update({ networkPolicy: 'deny-all' });
  await sandbox.writeFiles([
    {
      path: '/vercel/generated.mjs',
      content: Buffer.from('console.log("Hello from generated code");\n'),
    },
  ]);

  const command = await sandbox.runCommand({
    cmd: 'node',
    args: ['/vercel/generated.mjs'],
  });

  const stdout = await command.stdout();
  const stderr = await command.stderr();
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (command.exitCode !== 0) {
    throw new Error(`Generated command exited with code ${command.exitCode}.`);
  }
} finally {
  await sandbox.stop();
}
