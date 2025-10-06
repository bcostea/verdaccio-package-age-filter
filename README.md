# verdaccio-package-age-filter

A Verdaccio middleware plugin that automatically downgrades packages to older stable versions based on their publish date. This plugin helps ensure your team uses battle-tested package versions by preventing installation of packages that are too new.

## Features

- 🛡️ **Automatic Downgrading**: Instead of blocking requests, automatically serves older stable versions
- 🎯 **Configurable Age Threshold**: Set custom minimum age requirements (defaults to 7 days)
- 🔍 **Stable Version Filtering**: Automatically filters out pre-release versions (alpha, beta, rc, experimental, canary, etc.)
- 📊 **Transparent Operation**: Logs downgrade decisions for visibility
- ⚡ **Zero Configuration**: Works out of the box with sensible defaults

## Installation

```bash
npm install verdaccio-package-age-filter
```

Or install locally:

```bash
npm install /path/to/verdaccio-package-age-filter
```

## Configuration

Add the middleware to your Verdaccio `config.yaml`:

```yaml
middlewares:
  age-filter:
    enabled: true
    # Optional: customize max age in days (defaults to 7)
    maxAgeDays: 7
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable the plugin |
| `maxAgeDays` | number | `7` | Minimum age in days for packages |

## How It Works

1. **Intercept Package Requests**: The plugin intercepts all package metadata requests
2. **Check Publish Date**: Checks if the latest version was published less than the configured age threshold
3. **Find Stable Alternative**: Searches for the newest stable version that meets the age requirement
4. **Filter Pre-releases**: Automatically excludes versions with alpha, beta, rc, experimental, next, canary, dev, preview, pre, test, snapshot, or date-based identifiers
5. **Modify Metadata**: Updates the `dist-tags.latest` to point to the acceptable version
6. **Transparent Installation**: npm installs the older version without any error messages

## Example

Given this configuration:

```yaml
middlewares:
  age-filter:
    enabled: true
    maxAgeDays: 7
```

When a user runs `npm install axios`:

- **Latest version**: `axios@1.7.9` (published 2 days ago)
- **Plugin action**: Downgrades to `axios@1.7.7` (published 15 days ago)
- **User experience**: Package installs successfully with the older stable version
- **Log output**:
  ```
  warn --- Downgrading axios from 1.7.9 (2 days old) to 1.7.7 (15 days ago)
  ```

## Filtered Version Patterns

The plugin automatically excludes versions matching these patterns:

- `alpha` - Alpha releases
- `beta` - Beta releases
- `rc` - Release candidates
- `experimental` - Experimental builds
- `next` - Next versions
- `canary` - Canary builds
- `dev` - Development versions
- `preview` - Preview releases
- `pre` - Pre-releases
- `test` - Test versions
- `snapshot` - Snapshot builds
- Date-based snapshots (e.g., `-20231025`)

## Use Cases

### 1. **Risk Mitigation**
Prevent newly published packages from entering your production environment before they've been tested by the community.

### 2. **Security Compliance**
Ensure packages have enough time for security vulnerabilities to be discovered and patched.

### 3. **Stability Requirements**
Maintain stable development environments by using proven package versions.

### 4. **Testing Window**
Give your team time to test new package versions before they're automatically adopted.

## Logging

The plugin logs all downgrade decisions at the `warn` level:

```
warn --- Downgrading react from 19.2.0 (4 days old) to 19.1.1 (69 days old)
warn --- Downgrading pino from 10.0.0 (3 days old) to 9.12.0 (8 days old)
```

## Limitations

- **Scoped packages**: Currently processes non-scoped packages. Scoped packages (e.g., `@org/package`) pass through unchanged.
- **Package history**: Works best with packages that have clean version histories. Packages with complex or unusual version schemes may behave unexpectedly.
- **No version found**: If no stable version meeting the age requirement is found, the request is blocked with a 403 error.

## Development

### Project Structure

```
verdaccio-package-age-filter/
├── index.js         # Main plugin code
├── package.json     # Package metadata
└── README.md        # This file
```

### Testing Locally

1. Create a test Verdaccio instance:

```bash
npm install verdaccio
```

2. Install the plugin locally:

```bash
npm install ./verdaccio-package-age-filter
```

3. Configure `config.yaml`:

```yaml
middlewares:
  package-age-filter:
    enabled: true
    maxAgeDays: 7
```

4. Start Verdaccio:

```bash
verdaccio --config config.yaml
```

5. Test with npm:

```bash
npm config set registry http://localhost:4873/
npm install <package-name>
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on the GitHub repository.
