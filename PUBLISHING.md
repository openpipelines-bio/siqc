# Publishing Guide

This guide explains how to publish the QC Report Generator package to npm.

## Pre-Publishing Checklist

1. **Test the package locally:**
   ```bash
   npm run test:install
   ./test-global-usage.sh
   ```

2. **Update version in package.json** (following semantic versioning):
   ```bash
   # For patch releases (bug fixes)
   npm version patch
   
   # For minor releases (new features)  
   npm version minor
   
   # For major releases (breaking changes)
   npm version major
   ```

3. **Build the package:**
   ```bash
   npm run build
   ```

4. **Test the package files:**
   ```bash
   npm pack --dry-run
   ```

## Publishing to npm

1. **Login to npm:**
   ```bash
   npm login
   ```

2. **Publish the package:**
   ```bash
   npm publish
   ```

3. **Verify the publication:**
   ```bash
   npm view siqc
   ```

## Testing the Published Package

After publishing, test the global installation:

```bash
# Install from npm
npm install -g siqc

# Test the command
siqc --help

# Test with sample data (if available)
mkdir test-data/
echo '{"sample": {"columns": [{"name": "test", "dtype": "numeric", "data": [1,2,3]}]}}' > test-data/data.json
echo '{"title": "Test", "groups": []}' > test-data/structure.json
siqc --data-dir ./test-data/ --output ./test-report.html

# Clean up
rm -rf test-data/ test-report.html
npm uninstall -g siqc
```

## Package Contents

The published package includes:

- **CLI script**: `cli.js` - Main command-line interface
- **Source code**: `src/` - All source files for building reports  
- **Build system**: Vite configuration and plugins
- **Sample data**: Small test datasets for validation
- **Templates**: HTML template and styling
- **Tests**: Installation verification scripts

## Size Optimization

The package is optimized for npm distribution:

- Only essential files are included (see `files` in package.json)
- Sample datasets are small but representative
- Dependencies are properly categorized as dev vs runtime
- Build artifacts are excluded from the package

## Version History

- **0.1.0**: Initial release with CLI interface and progressive loading
- Future versions will follow semantic versioning

## Troubleshooting

### Common Issues

1. **"Command not found" after global install:**
   - Check npm global bin directory: `npm bin -g`
   - Ensure the directory is in your PATH

2. **Build fails on different Node versions:**
   - Package requires Node.js >= 18.0.0
   - Check engines in package.json

3. **Large file size:**
   - Consider using `--no-optional` during install
   - Check if all devDependencies are properly categorized

### Support

For issues and support:
- GitHub Issues: https://github.com/openpipelines-bio/siqc/issues
- Documentation: README.md and USAGE.md in the repository
