import { join } from 'path';
import { intersects } from 'semver';
import execa from 'execa';
import { debug, Meta, NowBuildError, NodeVersion } from '@now/build-utils';

interface RubyVersion extends NodeVersion {
  minor: number;
}

const allOptions: RubyVersion[] = [
  { major: 2, minor: 7, range: '2.7.x', runtime: 'ruby2.7' },
  { major: 2, minor: 6, range: '2.6.x', runtime: 'ruby2.6' },
];

function getLatestRubyVersion(): RubyVersion {
  return allOptions[0];
}

function getRubyPath(meta: Meta, gemfileContents: string) {
  let selection = getLatestRubyVersion();
  if (meta.isDev) {
    throw new Error(
      'Ruby is in the early alpha stage and does not support now dev at this time.'
    );
  } else if (gemfileContents) {
    const line = gemfileContents
      .split('\n')
      .find(line => line.startsWith('ruby'));
    if (line) {
      const strVersion = line
        .slice(4)
        .trim()
        .slice(0, -1)
        .replace('~>', '');
      const found = allOptions.some(o => {
        // The array is already in order so return the first
        // match which will be the newest version.
        selection = o;
        return intersects(o.range, strVersion);
      });
      if (!found) {
        throw new NowBuildError({
          code: 'NOW_RUBY_INVALID_VERSION',
          message: `Invalid Ruby Version: ${line}`,
        });
      }
    }
  }

  const { major, minor, runtime } = selection;
  const gemHome = '/ruby' + major + minor;
  const result = {
    gemHome,
    runtime,
    rubyPath: join(gemHome, 'bin', 'ruby'),
    gemPath: join(gemHome, 'bin', 'gem'),
    vendorPath: `vendor/bundle/ruby/${major}.${minor}.0`,
  };
  debug(JSON.stringify(result, null, ' '));
  return result;
}

// downloads and installs `bundler` (respecting
// process.env.GEM_HOME), and returns
// the absolute path to it
export async function installBundler(meta: Meta, gemfileContents: string) {
  const { gemHome, rubyPath, gemPath, vendorPath, runtime } = getRubyPath(
    meta,
    gemfileContents
  );

  debug('installing bundler...');
  await execa(gemPath, ['install', 'bundler', '--no-document'], {
    stdio: 'pipe',
    env: {
      GEM_HOME: gemHome,
    },
  });

  return {
    gemHome,
    rubyPath,
    gemPath,
    vendorPath,
    runtime,
    bundlerPath: join(gemHome, 'bin', 'bundler'),
  };
}
