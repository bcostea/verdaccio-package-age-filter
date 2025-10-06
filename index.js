/**
 * Verdaccio middleware plugin that automatically downgrades to older package versions
 */

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

class AgeFilterMiddleware {
  constructor(config, options) {
    this.logger = options.logger;
    this.maxAge = config.maxAgeDays ? config.maxAgeDays * 24 * 60 * 60 * 1000 : ONE_WEEK_MS;
  }

  isStableVersion(version) {
    // Skip pre-release versions (alpha, beta, rc, experimental, next, canary, etc.)
    const preReleasePatterns = [
      /alpha/i,
      /beta/i,
      /rc/i,
      /experimental/i,
      /next/i,
      /canary/i,
      /dev/i,
      /preview/i,
      /pre/i,
      /test/i,
      /-\d{8}/, // date-based snapshots
      /snapshot/i
    ];

    return !preReleasePatterns.some(pattern => pattern.test(version));
  }

  findOldestAcceptableVersion(pkg, maxAge) {
    if (!pkg || !pkg.time || !pkg.versions) {
      return null;
    }

    const now = new Date();
    let bestVersion = null;
    let bestVersionDate = null;

    // Find the newest STABLE version that's older than maxAge
    for (const [version, publishTime] of Object.entries(pkg.time)) {
      if (version === 'modified' || version === 'created') continue;

      // Skip if not in versions object (means it's just a timestamp entry)
      if (!pkg.versions[version]) continue;

      // Skip pre-release versions
      if (!this.isStableVersion(version)) continue;

      const publishDate = new Date(publishTime);
      const age = now - publishDate;

      if (age >= maxAge) {
        if (!bestVersionDate || publishDate > bestVersionDate) {
          bestVersion = version;
          bestVersionDate = publishDate;
        }
      }
    }

    return bestVersion;
  }

  register_middlewares(app, auth, storage) {
    const self = this;

    app.get('/:package', async (req, res, next) => {
      const packageName = req.params.package;

      // Skip scoped packages metadata endpoint
      if (packageName.startsWith('@')) {
        return next();
      }

      try {
        // Get package metadata
        const pkg = await new Promise((resolve, reject) => {
          storage.getPackage({
            name: packageName,
            req,
            callback: (err, manifest) => {
              if (err) reject(err);
              else resolve(manifest);
            }
          });
        });

        if (pkg && pkg.time && pkg['dist-tags'] && pkg['dist-tags'].latest) {
          const latestVersion = pkg['dist-tags'].latest;
          const publishTime = pkg.time[latestVersion];

          if (publishTime) {
            const publishDate = new Date(publishTime);
            const now = new Date();
            const age = now - publishDate;

            if (age < self.maxAge) {
              // Latest is too new, find an acceptable older version
              const acceptableVersion = self.findOldestAcceptableVersion(pkg, self.maxAge);

              if (acceptableVersion) {
                const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
                const acceptableAge = Math.floor((now - new Date(pkg.time[acceptableVersion])) / (24 * 60 * 60 * 1000));

                self.logger.warn(
                  {
                    package: packageName,
                    latestVersion,
                    downgradeVersion: acceptableVersion,
                    latestAge: daysOld,
                    downgradedAge: acceptableAge
                  },
                  `Downgrading ${packageName} from ${latestVersion} (${daysOld} days old) to ${acceptableVersion} (${acceptableAge} days old)`
                );

                // Modify the package metadata to point to the older version
                pkg['dist-tags'].latest = acceptableVersion;

                // Send the modified metadata
                return res.status(200).json(pkg);
              } else {
                // No acceptable version found
                const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
                self.logger.error(
                  { package: packageName, latestVersion, latestAge: daysOld },
                  `No acceptable version found for ${packageName} - all versions are too new`
                );

                return res.status(403).json({
                  error: 'No acceptable version',
                  message: `All versions of ${packageName} are newer than ${self.maxAge / (24 * 60 * 60 * 1000)} days.`
                });
              }
            }
          }
        }
      } catch (err) {
        // If we can't check the age, let it through
        self.logger.debug({ err, package: packageName }, 'Could not check package age');
      }

      next();
    });

    // Tarball downloads will automatically work with the modified metadata
    // since npm will request the version that was specified in dist-tags.latest
  }
}

module.exports = function (config, options) {
  return new AgeFilterMiddleware(config, options);
};
